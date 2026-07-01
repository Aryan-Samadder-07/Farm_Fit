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


# ── Async Firestore client (used by intake & webhook routes) ──────────────────

_async_db_client = None
_mock_async_db_client = None


def _build_mock_async_client():
    """
    Returns a lightweight async-compatible mock Firestore client for
    local development when MOCK_GCP_APIS=True.
    """
    import logging
    import uuid

    logger = logging.getLogger("mock_async_db")

    class _MockAsyncDocRef:
        def __init__(self, doc_id: str):
            self.id = doc_id

        async def set(self, data: dict, merge: bool = False):
            logger.info(f"[Mock AsyncDB] SET {self.id}: {data}")

        async def update(self, data: dict):
            logger.info(f"[Mock AsyncDB] UPDATE {self.id}: {data}")

    class _MockAsyncCollection:
        def __init__(self, name: str):
            self.name = name

        def document(self, doc_id: str = None) -> "_MockAsyncDocRef":
            return _MockAsyncDocRef(doc_id or str(uuid.uuid4()))

        async def add(self, data: dict):
            doc_id = str(uuid.uuid4())
            logger.info(f"[Mock AsyncDB] ADD to {self.name}/{doc_id}: {data}")
            return None, _MockAsyncDocRef(doc_id)

    class _MockAsyncFirestoreClient:
        def collection(self, name: str) -> "_MockAsyncCollection":
            return _MockAsyncCollection(name)

    return _MockAsyncFirestoreClient()


def get_async_db():
    """
    Returns a singleton async Firestore client (or a mock when MOCK_GCP_APIS=True).
    Use this in routes that call `await db.collection(...).document(...).set(...)`.
    The original sync `get_db()` is unaffected and remains for all existing services.
    """
    global _async_db_client, _mock_async_db_client

    if settings.MOCK_GCP_APIS:
        if _mock_async_db_client is None:
            _mock_async_db_client = _build_mock_async_client()
        return _mock_async_db_client

    if _async_db_client is None:
        try:
            project = settings.GCP_PROJECT_ID or settings.google_cloud_project or None
            database = settings.FIRESTORE_DATABASE or "(default)"
            _async_db_client = firestore.AsyncClient(project=project, database=database)
        except Exception as e:
            import logging
            logging.getLogger("db").warning(
                f"Failed to init AsyncClient: {e}. Falling back to mock."
            )
            _async_db_client = _build_mock_async_client()

    return _async_db_client
