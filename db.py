from google.cloud import firestore
from config import settings

_db_client = None

def get_db() -> firestore.Client:
    """
    Initializes and returns a singleton instance of the Firestore Client.
    Uses the project ID and database configured in settings.
    Automatically resolves credentials via standard GCP methods.
    """
    global _db_client
    if _db_client is None:
        # Initialize client with optional project and database specifications
        project = settings.google_cloud_project or None
        database = settings.firestore_database or "(default)"
        _db_client = firestore.Client(project=project, database=database)
    return _db_client
