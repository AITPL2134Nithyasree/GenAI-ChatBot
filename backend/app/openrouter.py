import json
import time
from collections.abc import AsyncIterator

import httpx

from .config import APP_NAME, APP_URL, MODELS_CACHE_TTL, OPENROUTER_API_KEY, OPENROUTER_BASE_URL


class OpenRouterError(Exception):
    pass


_models_cache: dict = {"at": 0.0, "data": []}


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": APP_URL,
        "X-Title": APP_NAME,
        "Content-Type": "application/json",
    }


def _is_text_chat(model: dict) -> bool:
    arch = model.get("architecture") or {}
    # Chat models only: accept text and produce text alone (excludes audio/image generators).
    return "text" in (arch.get("input_modalities") or ["text"]) and (arch.get("output_modalities") or ["text"]) == ["text"]


def _is_free(model: dict) -> bool:
    if model.get("id", "").endswith(":free"):
        return True
    pricing = model.get("pricing") or {}
    try:
        return float(pricing.get("prompt", 1)) == 0 and float(pricing.get("completion", 1)) == 0
    except (TypeError, ValueError):
        return False


async def list_free_models() -> list[dict]:
    if _models_cache["data"] and time.time() - _models_cache["at"] < MODELS_CACHE_TTL:
        return _models_cache["data"]
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{OPENROUTER_BASE_URL}/models")
        resp.raise_for_status()
        raw = resp.json().get("data", [])
    models = [
        {
            "id": m["id"],
            "name": m.get("name", m["id"]),
            "context_length": m.get("context_length"),
            "description": (m.get("description") or "")[:300],
        }
        for m in raw
        if _is_free(m) and _is_text_chat(m)
    ]
    models.sort(key=lambda m: m["name"].lower())
    _models_cache.update(at=time.time(), data=models)
    return models


async def stream_chat(model: str, messages: list[dict]) -> AsyncIterator[str]:
    """Yield content deltas from OpenRouter's streaming chat completions API."""
    if not OPENROUTER_API_KEY:
        raise OpenRouterError("OPENROUTER_API_KEY is not set on the server. Add it to backend/.env.")
    payload = {"model": model, "messages": messages, "stream": True}
    timeout = httpx.Timeout(connect=15, read=120, write=30, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST", f"{OPENROUTER_BASE_URL}/chat/completions", headers=_headers(), json=payload
        ) as resp:
            if resp.status_code != 200:
                body = (await resp.aread()).decode(errors="replace")
                try:
                    detail = json.loads(body).get("error", {}).get("message", body)
                except json.JSONDecodeError:
                    detail = body
                if resp.status_code == 429:
                    detail += " (free model is rate-limited; retry shortly or pick another model, e.g. Free Models Router)"
                raise OpenRouterError(f"OpenRouter {resp.status_code}: {detail}")
            async for line in resp.aiter_lines():
                # OpenRouter sends ": OPENROUTER PROCESSING" keep-alive comments
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if "error" in chunk:
                    raise OpenRouterError(chunk["error"].get("message", "Unknown streaming error"))
                choices = chunk.get("choices") or []
                if choices:
                    delta = choices[0].get("delta", {}).get("content")
                    if delta:
                        yield delta
