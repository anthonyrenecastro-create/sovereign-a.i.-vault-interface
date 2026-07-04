from __future__ import annotations

from typing import Iterable
import httpx

from app.config import SETTINGS
from app.models import ChatTurn


class OllamaClient:
    def __init__(self) -> None:
        self.base_url = SETTINGS.ollama_base_url.rstrip("/")

    def _model_for_profile(self, profile_model: str) -> str:
        if profile_model == "coder":
            return SETTINGS.model_coder
        if profile_model == "fast":
            return SETTINGS.model_fast
        if profile_model == "reasoning":
            return SETTINGS.model_reasoning
        return SETTINGS.model_default

    @staticmethod
    def _is_server_terminated_error(body: str) -> bool:
        low = body.lower()
        return (
            "llama-server process has terminated" in low
            or "signal: terminated" in low
            or "model requires more system memory" in low
        )

    async def _chat_once(self, model: str, messages: list[dict]) -> tuple[str, str]:
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.4,
                # Keep runtime stable on lower-memory targets.
                "num_ctx": SETTINGS.ollama_num_ctx,
            },
        }

        async with httpx.AsyncClient(timeout=SETTINGS.ollama_chat_timeout_seconds) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=payload)
            response.raise_for_status()
            data = response.json()

        output = data.get("message", {}).get("content", "")
        return output, model

    async def chat(
        self,
        profile_model: str,
        system_prompt: str,
        history: Iterable[ChatTurn],
        user_message: str,
        extra_context: str | None = None,
    ) -> tuple[str, str]:
        model = self._model_for_profile(profile_model)

        content = user_message
        if extra_context:
            content = f"Use this local context first:\n\n{extra_context}\n\nUser request:\n{user_message}"

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend({"role": turn.role, "content": turn.content} for turn in history)
        messages.append({"role": "user", "content": content})

        try:
            return await self._chat_once(model=model, messages=messages)
        except httpx.HTTPStatusError as exc:
            body = exc.response.text.strip()
            fallback_model = SETTINGS.model_fast
            if (
                exc.response.status_code >= 500
                and self._is_server_terminated_error(body)
                and fallback_model
                and fallback_model != model
            ):
                return await self._chat_once(model=fallback_model, messages=messages)
            raise


ollama_client = OllamaClient()
