import datetime
from typing import Dict, List, Any


DEFAULT_ODS = "FA565"


def iso_now():
    """Return current UTC timestamp in ISO-8601 with 'Z' suffix (seconds precision)."""
    return datetime.datetime.now().replace(microsecond=0).isoformat() + "Z"


def find_default_ods(entries: List[Dict[str, Any]]) -> str:
    for e in entries:
        res = e.get('resource', {})
        if res.get('resourceType') == 'Organization':
            for ident in res.get('identifier', []):
                if ident.get('system', '').endswith('/ods-organization-code'):
                    return ident.get('value')
    return DEFAULT_ODS
