import os
import sys
import time

# Add root directory to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load dotenv to match fastapi server startup environment exactly
from dotenv import load_dotenv
load_dotenv()

from config import settings
from db import get_db

def main():
    print("Testing Firestore database connection...")
    print(f"MOCK_GCP_APIS setting: {settings.MOCK_GCP_APIS}")
    print(f"GOOGLE_CLOUD_PROJECT: {os.environ.get('GOOGLE_CLOUD_PROJECT')}")
    print(f"GOOGLE_APPLICATION_CREDENTIALS: {os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}")
    
    start_time = time.time()
    try:
        db = get_db()
        print(f"Client initialized in {time.time() - start_time:.4f}s. Fetching 'tickets' collection stream (limit 5)...")
        
        query_start = time.time()
        docs = db.collection("tickets").limit(5).stream()
        
        count = 0
        for doc in docs:
            count += 1
            print(f"Found doc ID: {doc.id} -> {doc.to_dict()}")
            
        print(f"Success! Streamed {count} documents in {time.time() - query_start:.4f}s.")
    except Exception as e:
        print(f"Failed with exception after {time.time() - start_time:.4f}s:")
        print(type(e))
        print(e)

if __name__ == "__main__":
    main()
