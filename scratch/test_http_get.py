import requests

def main():
    url = "http://localhost:8001/api/v1/expert/tickets/d13ee899-6a8f-41df-a455-7682683bf064"
    print(f"Sending GET request to {url}...")
    try:
        res = requests.get(url)
        print(f"Status Code: {res.status_code}")
        print(f"Response Body: {res.text}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    main()
