from typing import Dict, Any, List


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

