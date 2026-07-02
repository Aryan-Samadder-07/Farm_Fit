import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv()

from db import get_db

def main():
    try:
        db = get_db()
        print("Querying all tickets from Firestore...")
        docs = db.collection("tickets").stream()
        
        count = 0
        for doc in docs:
            count += 1
            data = doc.to_dict()
            print(f"\n--- Ticket {doc.id} ---")
            for k, v in data.items():
                print(f"  {k}: type={type(v)} value={str(v)[:100]}")
        print(f"\nSuccessfully queried {count} tickets.")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
