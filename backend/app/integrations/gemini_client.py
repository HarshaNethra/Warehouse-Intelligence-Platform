import os
from typing import Optional
import httpx
from dotenv import load_dotenv
from app.config import settings

load_dotenv()

class GeminiClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.base_url = settings.GEMINI_BASE_URL
        
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip() and not self.api_key.startswith("mock_"))

    async def generate_response(
        self,
        prompt: str,
        system_prompt: str = settings.SYSTEM_ASSISTANT_PROMPT
    ) -> Optional[str]:
        if not self.is_configured():
            return None

        url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
        
        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": settings.GEMINI_TEMPERATURE,
                "maxOutputTokens": settings.GEMINI_MAX_OUTPUT_TOKENS
            }
        }

        headers = {"Content-Type": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"]
                return f"Gemini API returned status {response.status_code}: {response.text}"
        except Exception as e:
            return f"Gemini API Exception: {str(e)}"

gemini_client = GeminiClient()
