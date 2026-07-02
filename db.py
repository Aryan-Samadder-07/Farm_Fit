from google.cloud import firestore
from config import settings
import logging
import datetime

logger = logging.getLogger("db")

_db_client = None
_mock_sync_db_client = None

# Stateful In-Memory Database for Mock Mode (MOCK_GCP_APIS=True)
_MOCK_SYNC_STORE = {
    "tickets": {
        "mock_ticket_1": {
            "farmer_name": "mock_farmer",
            "crop_type": "Tomato",
            "disease_name": "Late Blight",
            "confidence": 0.95,
            "severity_level": "HIGH",
            "status": "RESOLVED",
            "created_at": "2026-06-25T12:00:00Z"
        }
    },
    "farmers": {
        "+919876543210": {
            "name": "Rajesh Kumar",
            "village_name": "Podalakur Mandal",
            "phone_number": "+919876543210"
        }
    },
    "professionals": {},
    "outbreaks": {},
    "alerts": {},
    "otps": {}
}

def _clean_mock_data(data: dict) -> dict:
    """
    Scans incoming mock data and converts Firestore Sentinel placeholders
    (like SERVER_TIMESTAMP) into ISO string datetimes.
    """
    cleaned = {}
    for k, v in data.items():
        if hasattr(v, '__class__') and v.__class__.__name__ == 'Sentinel':
            cleaned[k] = datetime.datetime.utcnow().isoformat() + "Z"
        else:
            cleaned[k] = v
    return cleaned

def _build_mock_sync_client():
    """
    Lightweight stateful mock Firestore client for local dev (MOCK_GCP_APIS=True).
    """
    import uuid

    class _MockDocRef:
        def __init__(self, collection_name: str, doc_id: str):
            self.collection_name = collection_name
            self.id = doc_id

        def set(self, data: dict, merge: bool = False):
            cleaned = _clean_mock_data(data)
            logger.info(f"[Mock SyncDB] SET {self.collection_name}/{self.id}: {cleaned}")
            if self.collection_name not in _MOCK_SYNC_STORE:
                _MOCK_SYNC_STORE[self.collection_name] = {}
            if merge:
                _MOCK_SYNC_STORE[self.collection_name][self.id] = {
                    **_MOCK_SYNC_STORE[self.collection_name].get(self.id, {}),
                    **cleaned
                }
            else:
                _MOCK_SYNC_STORE[self.collection_name][self.id] = cleaned
            return {"update_time": "mock-time"}

        def update(self, data: dict):
            cleaned = _clean_mock_data(data)
            logger.info(f"[Mock SyncDB] UPDATE {self.collection_name}/{self.id}: {cleaned}")
            if self.collection_name not in _MOCK_SYNC_STORE:
                _MOCK_SYNC_STORE[self.collection_name] = {}
            _MOCK_SYNC_STORE[self.collection_name][self.id] = {
                **_MOCK_SYNC_STORE[self.collection_name].get(self.id, {}),
                **cleaned
            }

        def delete(self):
            logger.info(f"[Mock SyncDB] DELETE {self.collection_name}/{self.id}")
            if self.collection_name in _MOCK_SYNC_STORE:
                _MOCK_SYNC_STORE[self.collection_name].pop(self.id, None)

        def get(self):
            class _MockDocSnapshot:
                def __init__(self, exists: bool, data: dict, doc_id: str):
                    self.exists = exists
                    self._data = data
                    self.id = doc_id
                def to_dict(self) -> dict:
                    return self._data
            
            coll = _MOCK_SYNC_STORE.get(self.collection_name, {})
            exists = self.id in coll
            data = coll.get(self.id, {})
            return _MockDocSnapshot(exists, data, self.id)

    class _MockCollection:
        def __init__(self, name: str):
            self.name = name
            if name not in _MOCK_SYNC_STORE:
                _MOCK_SYNC_STORE[name] = {}

        def document(self, doc_id: str = None) -> "_MockDocRef":
            return _MockDocRef(self.name, doc_id or str(uuid.uuid4()))

        def add(self, data: dict):
            cleaned = _clean_mock_data(data)
            doc_id = str(uuid.uuid4())
            logger.info(f"[Mock SyncDB] ADD {self.name}/{doc_id}: {cleaned}")
            _MOCK_SYNC_STORE[self.name][doc_id] = cleaned
            return None, _MockDocRef(self.name, doc_id)

        def where(self, *a, **kw):
            return self

        def order_by(self, *a, **kw):
            return self

        def limit(self, *a, **kw):
            return self

        def stream(self):
            results = []
            coll = _MOCK_SYNC_STORE.get(self.name, {})
            for doc_id, data in coll.items():
                class _MockSnapshot:
                    def __init__(self, id, d):
                        self.id = id
                        self._d = d
                    def to_dict(self):
                        return self._d
                results.append(_MockSnapshot(doc_id, data))
            return iter(results)

    class _MockFirestoreClient:
        class Query:
            DESCENDING = "DESCENDING"

        def collection(self, name: str) -> "_MockCollection":
            return _MockCollection(name)

    return _MockFirestoreClient()


def get_db():
    """
    Returns a singleton Firestore Client (sync).
    Falls back to a mock client when MOCK_GCP_APIS=True (no GCP credentials needed).
    """
    global _db_client, _mock_sync_db_client

    if settings.MOCK_GCP_APIS:
        if _mock_sync_db_client is None:
            _mock_sync_db_client = _build_mock_sync_client()
            logger.info("[db.py] Mock sync Firestore client initialized.")
        return _mock_sync_db_client

    if _db_client is None:
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
    import uuid
    logger = logging.getLogger("mock_async_db")

    class _MockAsyncDocRef:
        def __init__(self, collection_name: str, doc_id: str):
            self.collection_name = collection_name
            self.id = doc_id

        async def set(self, data: dict, merge: bool = False):
            cleaned = _clean_mock_data(data)
            logger.info(f"[Mock AsyncDB] SET {self.collection_name}/{self.id}: {cleaned}")
            if self.collection_name not in _MOCK_SYNC_STORE:
                _MOCK_SYNC_STORE[self.collection_name] = {}
            _MOCK_SYNC_STORE[self.collection_name][self.id] = cleaned

        async def update(self, data: dict):
            cleaned = _clean_mock_data(data)
            logger.info(f"[Mock AsyncDB] UPDATE {self.collection_name}/{self.id}: {cleaned}")
            if self.collection_name not in _MOCK_SYNC_STORE:
                _MOCK_SYNC_STORE[self.collection_name] = {}
            _MOCK_SYNC_STORE[self.collection_name][self.id] = {
                **_MOCK_SYNC_STORE[self.collection_name].get(self.id, {}),
                **cleaned
            }

    class _MockAsyncCollection:
        def __init__(self, name: str):
            self.name = name

        def document(self, doc_id: str = None) -> "_MockAsyncDocRef":
            return _MockAsyncDocRef(self.name, doc_id or str(uuid.uuid4()))

        async def add(self, data: dict):
            cleaned = _clean_mock_data(data)
            doc_id = str(uuid.uuid4())
            logger.info(f"[Mock AsyncDB] ADD to {self.name}/{doc_id}: {cleaned}")
            if self.name not in _MOCK_SYNC_STORE:
                _MOCK_SYNC_STORE[self.name] = {}
            _MOCK_SYNC_STORE[self.name][doc_id] = cleaned
            return None, _MockAsyncDocRef(self.name, doc_id)

    class _MockAsyncFirestoreClient:
        def collection(self, name: str) -> "_MockAsyncCollection":
            return _MockAsyncCollection(name)

    return _MockAsyncFirestoreClient()


def get_async_db():
    """
    Returns a singleton async Firestore client (or a mock when MOCK_GCP_APIS=True).
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
