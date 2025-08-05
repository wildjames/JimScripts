import datetime

def iso_now():
    """Return current UTC timestamp in ISO-8601 with 'Z' suffix (seconds precision)."""
    return datetime.datetime.now().replace(microsecond=0).isoformat() + "Z"
