import httpx
import json

def test_yield():
    url = "http://localhost:8001/api/v1/yield/predict"
    
    payload = {
        "crop_name": "Tomato",
        "soil_parameters": {
            "N": 50.0,
            "P": 35.0,
            "K": 70.0,
            "pH": 6.3
        },
        "latitude": 14.44,
        "longitude": 79.98,
        "sowing_date": "2026-06-01",
        "farm_size_acres": 2.5
    }
    
    print(f"Sending yield prediction request to {url}...")
    try:
        response = httpx.post(url, json=payload, timeout=10.0)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Error detail: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_yield()
