import httpx
import json

def test_risk():
    url = "http://localhost:8001/api/v1/risk/analyze"
    
    # Let's test a high-risk case (drought, low nitrogen, high severity disease, and recurring history)
    payload = {
        "soil_parameters": {
            "N": 15.0,   # Deficient
            "P": 35.0,   # Good
            "K": 80.0,   # Good
            "pH": 5.2    # Acidic
        },
        "disease_severity": "HIGH",
        "latitude": 14.68,   # Anantapur regional center (dry spell trigger)
        "longitude": 77.60,
        "previous_diagnoses_count": 3
    }
    
    print(f"Sending risk analysis request to {url}...")
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
    test_risk()
