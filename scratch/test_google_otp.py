import requests

def main():
    url = "http://localhost:8001/api/v1/auth/google/signup/request-otp"
    payload = {
        "email": "test_verification_user@gmail.com",
        "phone_number": "+919999999999"
    }
    print(f"Sending POST to {url}...")
    try:
        res = requests.post(url, json=payload)
        print(f"Status Code: {res.status_code}")
        print(f"Response JSON: {res.json()}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    main()
