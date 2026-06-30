import httpx
import json

def test_history():
    url = "http://localhost:8001/api/v1/farm/history/mock_farmer"
    
    print(f"Sending historical analytics request to {url}...")
    try:
        response = httpx.get(url, timeout=10.0)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Error detail: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_history()
