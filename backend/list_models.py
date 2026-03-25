import os
from pathlib import Path

import requests
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)
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
