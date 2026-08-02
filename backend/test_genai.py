import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)
api_key = os.getenv("GOOGLE_API_KEY")

models_to_test = [
    os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-pro-latest",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
]

for m in models_to_test:
    print(f"Testing {m}...")
    try:
        llm = ChatGoogleGenerativeAI(model=m, google_api_key=api_key)
        res = llm.invoke("Hi")
        print(f"✅ Success with {m}: {res.content[:20]}...")
        break
    except Exception as e:
        print(f"❌ Failed {m}: {str(e)[:100]}")
