import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

models_to_test = [
    "gemini-1.5-flash",
    "models/gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-pro",
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
