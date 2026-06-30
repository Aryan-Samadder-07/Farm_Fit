import httpx
import json

def test_phase2():
    print("=== TESTING PHASE 2 ENDPOINTS ===")
    
    # 1. Test Knowledge RAG Query
    knowledge_url = "http://localhost:8001/api/v1/knowledge/query"
    knowledge_payload = {
        "query": "late blight in tomato Metalaxyl Mancozeb",
        "top_k": 1
    }
    print(f"\n1. Sending Knowledge RAG Query to {knowledge_url}...")
    try:
        res = httpx.post(knowledge_url, json=knowledge_payload, timeout=10.0)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            print("Knowledge matches:")
            print(json.dumps(res.json(), indent=2))
        else:
            print(f"Error: {res.text}")
    except Exception as e:
        print(f"Failed: {e}")

    # 2. Test Government Schemes
    schemes_url = "http://localhost:8001/api/v1/government/schemes?farmer_name=Rao&crop_type=Rice&farm_size_acres=1.5&location_id=AP_Guntur"
    print(f"\n2. Sending Government Schemes query to {schemes_url}...")
    try:
        res = httpx.get(schemes_url, timeout=10.0)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            print("Schemes returned:")
            print(json.dumps(res.json(), indent=2))
        else:
            print(f"Error: {res.text}")
    except Exception as e:
        print(f"Failed: {e}")

    # 3. Test Market Prices
    market_url = "http://localhost:8001/api/v1/market/prices?crop_name=Tomato&location_id=AP_Nellore"
    print(f"\n3. Sending Market Mandi query to {market_url}...")
    try:
        res = httpx.get(market_url, timeout=10.0)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            print("Mandi prices returned:")
            print(json.dumps(res.json(), indent=2))
        else:
            print(f"Error: {res.text}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_phase2()
