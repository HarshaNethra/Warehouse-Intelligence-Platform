import os
from typing import Optional
import httpx

class ClaudeClient:
    def __init__(self, api_key: Optional[str] = None):
        # Fallback to a mock key to avoid errors if not configured yet
        self.api_key = api_key or os.getenv("CLAUDE_API_KEY", "mock_key")
        self.model = os.getenv("CLAUDE_MODEL", "claude-3-haiku-20240307")
        self.api_url = "https://api.anthropic.com/v1/messages"

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip() and not self.api_key.startswith("mock_"))

    async def generate_response(
        self,
        prompt: str,
        system_prompt: str = "You are an AI assistant for a Warehouse Intelligence Platform. Answer questions strictly grounded in the provided warehouse incident data."
    ) -> Optional[str]:
        if not self.is_configured():
            return None

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.api_url, headers=headers, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("content", [])
                    if content and isinstance(content, list) and "text" in content[0]:
                        return content[0]["text"]
                return f"Error: API returned status {response.status_code}"
        except Exception as e:
            return f"Exception occurred: {str(e)}"

claude_client = ClaudeClient()
