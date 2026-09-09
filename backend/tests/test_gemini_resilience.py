import pytest
import asyncio
import time
from unittest.mock import AsyncMock, patch, MagicMock
from app.integrations.gemini_client import GeminiClient, AdaptiveRateLimiter
from app.api.assistant import chat
from app.schemas.assistant import ChatRequest
from app.db.models import User

def test_adaptive_rate_limiter_zero_delay_under_budget():
    """Verify that under safe RPM limits, the rate limiter introduces 0ms delay."""
    async def _run():
        limiter = AdaptiveRateLimiter(max_rpm=14)
        start_t = time.time()
        for _ in range(5):
            await limiter.acquire()
        elapsed_ms = (time.time() - start_t) * 1000
        assert elapsed_ms < 50, f"Rate limiter introduced unnecessary delay: {elapsed_ms}ms"
    asyncio.run(_run())


def test_gemini_in_flight_deduplication():
    """Verify concurrent identical requests share a single in-flight execution."""
    async def _run():
        client = GeminiClient(api_key="AIzaSyTestMockKey")
        
        call_count = 0
        async def mock_execute(prompt, system_prompt, req_id):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.05) # Simulate API latency
            return f"Response for {prompt}"

        client._execute_with_retry = mock_execute

        # Dispatch 3 identical queries simultaneously
        results = await asyncio.gather(
            client.generate_response("Test Question A"),
            client.generate_response("Test Question A"),
            client.generate_response("Test Question A"),
        )

        assert results == ["Response for Test Question A"] * 3
        assert call_count == 1, f"Expected exactly 1 Gemini call for deduplicated in-flight requests, got {call_count}"
    asyncio.run(_run())


def test_gemini_non_retryable_errors_fail_fast():
    """Verify HTTP 400, 401, 403, 404 fail immediately without retrying."""
    async def _run():
        client = GeminiClient(api_key="AIzaSyTestMockKey")
        
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.text = '{"error": {"message": "models/gemini-invalid is not found"}}'
        mock_resp.json.return_value = {"error": {"message": "models/gemini-invalid is not found"}}

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            result = await client.generate_response("Test Query")
            
            assert result is None
            # Must only call ONCE (no retries on 404)
            assert mock_post.call_count == 1
    asyncio.run(_run())


def test_gemini_transient_503_recovers_with_backoff():
    """Verify HTTP 503 retries with backoff and succeeds on subsequent attempt."""
    async def _run():
        client = GeminiClient(api_key="AIzaSyTestMockKey")
        
        mock_resp_503 = MagicMock()
        mock_resp_503.status_code = 503
        mock_resp_503.headers = {}
        mock_resp_503.text = "Service Unavailable"

        mock_resp_200 = MagicMock()
        mock_resp_200.status_code = 200
        mock_resp_200.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "Grounded safe response"}]}}]
        }

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            # First call fails 503, second call succeeds 200
            mock_post.side_effect = [mock_resp_503, mock_resp_200]
            
            start_t = time.time()
            result = await client.generate_response("Test Recovery Query")
            elapsed_s = time.time() - start_t

            assert result == "Grounded safe response"
            assert mock_post.call_count == 2
            # Backoff delay should be ~1.0 - 1.5s
            assert elapsed_s >= 0.9
    asyncio.run(_run())


def test_local_greeting_bypass_performance():
    """Verify greetings return instantly in < 15ms without calling Gemini."""
    async def _run():
        db_mock = MagicMock()
        user = User(id="usr-test", email="test@warehouse.io", role="ADMIN", facility_id="FAC-001")
        
        start_t = time.time()
        chat_resp = await chat(
            request=ChatRequest(question="Hello there! What can you do?"),
            db=db_mock,
            current_user=user
        )
        elapsed_ms = (time.time() - start_t) * 1000

        assert "AI Operations Assistant" in chat_resp.answer
        assert chat_resp.model_used == "Local-Rule-Assistant"
        assert elapsed_ms < 20, f"Greeting took too long: {elapsed_ms}ms"
    asyncio.run(_run())
