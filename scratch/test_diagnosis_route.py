import httpx
import asyncio

async def test_route():
    # Simple 1x1 transparent GIF byte stream as dummy image data
    dummy_image = (
        b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00"
        b",\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
    )
    
    url = "http://localhost:8001/api/v1/diagnosis/diagnose"
    
    files = {
        "image": ("test_leaf.gif", dummy_image, "image/gif")
    }
    data = {
        "problem_transcript": "The corn leaves have large brown spots spreading from the center. It looks dry and burnt.",
        "farmer_name": "Rao Prasad",
        "crop_type": "Corn"
    }
    
    print(f"Sending diagnostic POST request to {url}...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=data, files=files, timeout=30.0)
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                print("Response JSON:")
                import json
                print(json.dumps(response.json(), indent=2))
            else:
                print(f"Error detail: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_route())
