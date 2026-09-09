import time
import uuid
import random
import asyncio
import logging
from typing import Optional, Dict
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class AdaptiveRateLimiter:
    """
    Non-blocking sliding-window rate limiter.
    Adds ZERO delay when operating under quota budget (normal path is immediate).
    Only paces requests if the safe RPM limit is actively reached.
    """
    def __init__(self, max_rpm: int = 14):
        self.max_rpm = max_rpm
        self.window_seconds = 60.0
        self.timestamps = []
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.time()
            # Clean up timestamps older than window
            self.timestamps = [t for t in self.timestamps if now - t < self.window_seconds]
            
            if len(self.timestamps) >= self.max_rpm:
                # Need to wait only until the oldest timestamp exits the window
                oldest = self.timestamps[0]
                wait_time = max(0.05, (oldest + self.window_seconds) - now + 0.1)
                logger.info(f"[RateLimiter] Pacing request for {wait_time:.2f}s to protect API quota ({len(self.timestamps)}/{self.max_rpm} RPM)")
                await asyncio.sleep(wait_time)
                now = time.time()
                self.timestamps = [t for t in self.timestamps if now - t < self.window_seconds]

            self.timestamps.append(time.time())


class GeminiClient:
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key
        self.model = settings.GEMINI_MODEL
        self.base_url = settings.GEMINI_BASE_URL
        self._rate_limiter = AdaptiveRateLimiter(max_rpm=14)
        self._in_flight_requests: Dict[str, asyncio.Future] = {}
        self._in_flight_lock = asyncio.Lock()

    @property
    def api_key(self) -> str:
        return self._api_key or settings.GEMINI_API_KEY

    def is_configured(self) -> bool:
        key = self.api_key
        return bool(key and key.strip() and not key.startswith("mock_"))

    async def generate_response(
        self,
        prompt: str,
        system_prompt: str = settings.SYSTEM_ASSISTANT_PROMPT,
        request_id: Optional[str] = None
    ) -> Optional[str]:
        if not self.is_configured():
            return None

        req_id = request_id or f"gemini-{uuid.uuid4().hex[:8]}"
        
        # 1. In-flight Deduplication for identical concurrent queries
        dedup_key = f"{self.model}:{hash((prompt, system_prompt))}"
        async with self._in_flight_lock:
            if dedup_key in self._in_flight_requests:
                logger.info(f"[{req_id}] Reusing in-flight Gemini request for duplicate query")
                return await self._in_flight_requests[dedup_key]
            
            loop = asyncio.get_running_loop()
            future = loop.create_future()
            self._in_flight_requests[dedup_key] = future

        try:
            result = await self._execute_with_retry(prompt, system_prompt, req_id)
            if not future.done():
                future.set_result(result)
            return result
        except Exception as e:
            if not future.done():
                future.set_exception(e)
            raise e
        finally:
            async with self._in_flight_lock:
                self._in_flight_requests.pop(dedup_key, None)

    async def _execute_with_retry(
        self,
        prompt: str,
        system_prompt: str,
        req_id: str
    ) -> Optional[str]:
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
        max_attempts = 3
        
        # Approximate input token estimation (1 token ~= 4 chars)
        approx_in_tokens = (len(prompt) + len(system_prompt)) // 4

        for attempt in range(1, max_attempts + 1):
            # Adaptive rate limiting (0ms delay if under quota)
            await self._rate_limiter.acquire()
            start_t = time.time()

            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    latency_ms = round((time.time() - start_t) * 1000, 1)

                    # HTTP 200: Immediate Success
                    if response.status_code == 200:
                        data = response.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                text_out = parts[0]["text"]
                                approx_out_tokens = len(text_out) // 4
                                logger.info(
                                    f"[{req_id}] HTTP 200 OK | model={self.model} | "
                                    f"latency={latency_ms}ms | tokens≈{approx_in_tokens}in/{approx_out_tokens}out"
                                )
                                return text_out

                    # HTTP 400, 401, 403, 404: Non-transient errors (DO NOT RETRY)
                    if response.status_code in [400, 401, 403, 404]:
                        err_msg = ""
                        try:
                            err_msg = response.json().get("error", {}).get("message", response.text)
                        except Exception:
                            err_msg = response.text
                        logger.error(f"[{req_id}] Non-retryable error {response.status_code} ({self.model}): {err_msg}")
                        return None

                    # HTTP 429, 503, 500, 502, 504: Transient errors (RETRY WITH BOUNDED BACKOFF)
                    if response.status_code in [429, 500, 502, 503, 504]:
                        retry_after = response.headers.get("Retry-After")
                        if retry_after and retry_after.isdigit():
                            backoff = float(retry_after)
                        else:
                            backoff = (1.0 * (2 ** (attempt - 1))) + random.uniform(0.1, 0.3)

                        logger.warning(
                            f"[{req_id}] Transient status {response.status_code} (attempt {attempt}/{max_attempts}). "
                            f"Backing off for {backoff:.2f}s..."
                        )

                        if attempt < max_attempts:
                            await asyncio.sleep(backoff)
                            continue
                        else:
                            logger.error(f"[{req_id}] Max retries exhausted after status {response.status_code}")
                            return None

                    logger.warning(f"[{req_id}] Unexpected status {response.status_code}: {response.text[:200]}")
                    return None

            except (httpx.TimeoutException, httpx.NetworkError) as net_err:
                latency_ms = round((time.time() - start_t) * 1000, 1)
                logger.warning(f"[{req_id}] Network error ({net_err.__class__.__name__}) on attempt {attempt}/{max_attempts} after {latency_ms}ms")
                if attempt < max_attempts:
                    backoff = (1.0 * (2 ** (attempt - 1))) + random.uniform(0.1, 0.3)
                    await asyncio.sleep(backoff)
                    continue
                return None
            except Exception as e:
                logger.error(f"[{req_id}] Unexpected exception: {e}")
                return None

        return None


gemini_client = GeminiClient()


