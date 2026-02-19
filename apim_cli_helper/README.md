# APIM CLI Helper

A lightweight CLI tool for obtaining NHS APIM authentication tokens using the `pytest-nhsd-apim` package. Designed to be called from TypeScript/Node.js projects via `child_process`.

## Installation

### Install with Poetry (Recommended)

```bash
cd apim_cli_helper
poetry install
```

This creates a virtual environment and installs the `apim-token` command.

### Make it globally accessible (for use from TypeScript)

```bash
poetry install
# The tool is now available as 'apim-token' when running in the poetry environment
# Or install it with pipx for global access:
pipx install .
```

## Usage

### JWT Authentication (Client Credentials)

```bash
export CLIENT_ID="your-client-id"
export JWT_KID="your-key-id"
export JWT_PRIVATE_KEY="$(cat path/to/private_key.pem)"

apim-token --auth-type jwt --environment int
```

### OAuth2 Authentication (Authorization Code)

```bash
export CLIENT_ID="your-client-id"
export CLIENT_SECRET="your-client-secret"
export USERNAME="test-user-id"  # optional
export SCOPE="nhs-cis2"          # optional

apim-token --auth-type oauth2 --environment int
```

## Output Formats

By default, outputs just the access token to stdout:
```bash
apim-token --auth-type jwt --environment int --output token
```

For the full token response (including expires_in, token_type, etc.):
```bash
apim-token --auth-type jwt --environment int --output full
```

## Usage from TypeScript

```typescript
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

function getToken(authType: 'jwt' | 'oauth2', environment: string): string {
  // Use poetry run to execute in the virtual environment
  const result = execSync(
    `poetry run apim-token --auth-type ${authType} --environment ${environment}`,
    {
      cwd: '/path/to/apim_cli_helper',
      env: {
        ...process.env,
        CLIENT_ID: 'your-client-id',
        JWT_KID: 'your-key-id',
        JWT_PRIVATE_KEY: readFileSync('private_key.pem', 'utf8'),
      },
      encoding: 'utf8'
    }
  );
  return result.trim();
}

// Usage
const token = getToken('jwt', 'int');
console.log('Access token:', token);
```

### Alternative: Direct invocation (if installed with pipx)

If you've installed with `pipx install .`, you can call it directly:

```typescript
const result = execSync(
  `apim-token --auth-type ${authType} --environment ${environment}`,
  { env: { ...process.env, CLIENT_ID: '...', ... }, encoding: 'utf8' }
);
```

## Environment Variables

### JWT Mode
- `CLIENT_ID` - (required) Client ID for the application
- `JWT_KID` - (required) Key ID for JWT signing
- `JWT_PRIVATE_KEY` - (required) Private key for JWT signing (PEM format)

### OAuth2 Mode
- `CLIENT_ID` - (required) Client ID for the application
- `CLIENT_SECRET` - (required) Client secret for the application
- `USERNAME` - (optional) Username for authentication (default: "test-user")
- `SCOPE` - (optional) OAuth2 scope (default: "nhs-cis2")
- `CALLBACK_URL` - (optional) OAuth2 callback URL (default: "https://google.com")

## Error Handling

Errors are output to stderr as JSON:
```json
{
  "error": "Error message",
  "type": "ValueError"
}
```

Exit codes:
- `0` - Success
- `1` - Error occurred

## Development

```bash
# Install dependencies
poetry install

# Run directly
poetry run apim-token --auth-type jwt --environment int

# Build package
poetry build
```
