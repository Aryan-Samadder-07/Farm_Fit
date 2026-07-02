import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv()

from config import settings
from db import get_db

def main():
    ticket_id = "d13ee899-6a8f-41df-a455-7682683bf064"
    print(f"MOCK_GCP_APIS: {settings.MOCK_GCP_APIS}")
    try:
        db = get_db()
        print(f"Fetching document {ticket_id}...")
        doc = db.collection("tickets").document(ticket_id).get()
        if not doc.exists:
            print("Document does not exist in Firestore!")
            return
        
        data = doc.to_dict()
        print("Raw document keys:", list(data.keys()))
        
        serialized = {"id": doc.id}
        for key, val in data.items():
            print(f"Serializing {key}: type={type(val)}")
            # Try serializing like expert.py does
            if isinstance(val, list):
                serialized[key] = val
            elif hasattr(val, 'isoformat'):
                serialized[key] = val.isoformat()
            else:
                serialized[key] = val
        print("Serialization successful!")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
