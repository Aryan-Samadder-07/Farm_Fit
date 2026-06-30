import httpx
import json

def test_agronomy():
    url = "http://localhost:8001/api/v1/agronomy/recommend"
    payload = {
        "N": 75.0,
        "P": 35.0,
        "K": 20.0,
        "pH": 6.2,
        "latitude": 14.44,
        "longitude": 79.98
    }
    
    print(f"Sending agronomy POST request to {url}...")
    try:
        response = httpx.post(url, json=payload, timeout=20.0)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Error detail: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_agronomy()
