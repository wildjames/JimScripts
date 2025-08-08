import os
import pathlib
import uuid
import secrets
import hashlib
import base64
import requests
from typing import Dict, Any, List
from urllib.parse import urlparse, parse_qs

# Selenium imports
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.firefox.service import Service
from webdriver_manager.firefox import GeckoDriverManager


# Used to authenticate to mock NHS login
AUTH_USERNAME = os.getenv("AUTH_USERNAME", "9449304130")


def load_collection_entries(body: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Given the top-level PfP response JSON, return the inner 'collection' entries list.
    """
    try:
        top = body['entry'][0]['resource']
        if top.get('resourceType') == 'Bundle' and top.get('type') == 'collection':
            return top['entry']
    except (KeyError, IndexError, TypeError):
        pass

    raise ValueError("Error: Unable to locate the inner collection bundle in input.")


def generate_pkce_pair():
    """
    Generate a PKCE code_verifier and corresponding code_challenge (S256).
    """
    code_verifier = secrets.token_urlsafe(64)[:128]
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge


def get_access_token_via_auth_code(
    host: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    firefox_tmp_dir: str = "./tmp/test_firefox"
) -> str:
    """
    1) Builds the auth URL with PKCE and opens it in a headless browser.
    2) Auto-fills the username field and submits the form.
    3) Waits for the callback to the redirect_uri and grabs the code.
    4) Exchanges the code + verifier for an access token.
    """
    # Generate PKCE values
    code_verifier, code_challenge = generate_pkce_pair()

    # Build the authorization URL
    auth_url = (
        f"https://{host}/oauth2-mock/authorize"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=nhs-login"
        f"&state=state123"
        f"&code_challenge={code_challenge}"
        f"&code_challenge_method=S256"
    )

    # In order to have a profile, we need a read/write directory
    FIREFOX_TMP_DIR = pathlib.Path(firefox_tmp_dir)
    FIREFOX_TMP_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["TMPDIR"] = str(FIREFOX_TMP_DIR)

    # Set up firefox
    firefox_options = FirefoxOptions()
    firefox_options.add_argument("--window-size=300,300")
    firefox_options.add_argument("--disable-gpu")
    firefox_options.add_argument("--no-sandbox")
    # firefox_options.add_argument("--headless")
    firefox_options.add_argument("--disable-dev-shm-usage")

    # Initialize GeckoDriver using webdriver-manager
    service = Service(GeckoDriverManager().install())
    driver = webdriver.Firefox(service=service, options=firefox_options)

    # Get the auth code via the browser
    try:
        driver.get(auth_url)

        # Wait until the username input is present
        wait = WebDriverWait(driver, 20)
        user_input = wait.until(
            EC.presence_of_element_located((By.ID, "username"))
        )
        # Fill in the NHS username
        user_input.send_keys(AUTH_USERNAME)
        user_input.send_keys(Keys.ENTER)

        # Wait for redirect
        wait.until(lambda d: d.current_url.startswith(redirect_uri))
        redirect_response = driver.current_url

    finally:
        driver.quit()

    # Parse the code out of the URL
    parsed = urlparse(redirect_response)
    params = parse_qs(parsed.query)
    code = params.get("code", [None])[0]
    if not code:
        raise ValueError("no `code` parameter found in the callback URL.")

    # Exchange the code for an access token
    token_url = f"https://{host}/oauth2-mock/token"
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
        'scope': 'nhs-login',
        'client_id': client_id,
        'client_secret': client_secret,
        'code_verifier': code_verifier,
    }
    resp = requests.post(token_url, data=data)
    resp.raise_for_status()
    tok = resp.json().get('access_token')
    if not tok:
        raise RuntimeError("No access_token in OAuth2 token response")

    return tok


def fetch_bundle(
    host: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    nhs_number: str
) -> Dict[str, Any]:
    """
    Call the Bundle endpoint and return the parsed JSON.
    """
    token = get_access_token_via_auth_code(
        host, client_id, client_secret, redirect_uri
    )

    url = f"https://{host}/prescriptions-for-patients/Bundle"
    headers = {
        'Authorization': f"Bearer {token}",
        'x-request-id': str(uuid.uuid4()),
        'x-correlation-id': str(uuid.uuid4()),
        'x-nhs-number': nhs_number,
    }
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    return resp.json()

