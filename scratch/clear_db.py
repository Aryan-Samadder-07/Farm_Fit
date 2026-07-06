import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv()

from db import get_db

def delete_collection(db, collection_name, batch_size=50):
    coll_ref = db.collection(collection_name)
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0

    for doc in docs:
        print(f"Deleting doc {doc.id} from {collection_name}...")
        doc.reference.delete()
        deleted += 1

    if deleted >= batch_size:
        return delete_collection(db, collection_name, batch_size)
    
    print(f"Purged {deleted} records from '{collection_name}' collection.")

def main():
    try:
        db = get_db()
        print("Starting Firestore database purge...")
        
        collections = [
            "farmers", 
            "professionals", 
            "tickets", 
            "otps", 
            "collective_analytics", 
            "alerts", 
            "weather_alerts"
        ]
        
        for coll in collections:
            delete_collection(db, coll)
            
        print("Database purge completed successfully!")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
