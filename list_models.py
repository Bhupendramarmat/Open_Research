import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
response = requests.get(url)

if response.status_code == 200:
    for model in response.json().get("models", []):
        name = model.get("name")
        methods = model.get("supportedGenerationMethods", [])
        if "generateContent" in methods:
            print(f"VALID: {name}")
else:
    print("FAILED TO FETCH")
