import os
import sys
import asyncio

# Add root directory to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from google import genai
from config import settings

async def main():
    print("Testing Gemini client initialization...")
    print(f"Key from config: {settings.gemini_api_key}")
    
    client = genai.Client(api_key=settings.gemini_api_key or None)
    
    for model_name in ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"]:
        print(f"\nSending request to model: {model_name}...")
        try:
            response = client.models.generate_content(
                model=model_name,
                contents="Say hello!"
            )
            print(f"Success with {model_name}! Response:")
            print(response.text)
            break
        except Exception as e:
            print(f"Failed for {model_name} with error:")
            print(e)

if __name__ == "__main__":
    asyncio.run(main())
