from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("SOVEREIGN_HOST", "0.0.0.0")
    port: int = int(os.getenv("SOVEREIGN_PORT", "8000"))
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    model_default: str = os.getenv("OLLAMA_MODEL_DEFAULT", "gemma3:4b")
    model_reasoning: str = os.getenv("OLLAMA_MODEL_REASONING", "qwen2.5:7b")
    model_coder: str = os.getenv("OLLAMA_MODEL_CODER", "qwen2.5:7b")
    model_fast: str = os.getenv("OLLAMA_MODEL_FAST", "gemma3:4b")
    model_embedding: str = os.getenv("OLLAMA_MODEL_EMBEDDING", "nomic-embed-text")
    ollama_chat_timeout_seconds: int = int(os.getenv("OLLAMA_CHAT_TIMEOUT_SECONDS", "120"))
    ollama_num_ctx: int = int(os.getenv("OLLAMA_NUM_CTX", "1024"))
    data_dir: str = os.getenv("SOVEREIGN_DATA_DIR", "./data")
    admin_token: str = os.getenv("SOVEREIGN_ADMIN_TOKEN", "change-me")
    auth_secret: str = os.getenv("SOVEREIGN_AUTH_SECRET", "change-this-auth-secret")
    auth_token_ttl_minutes: int = int(os.getenv("SOVEREIGN_AUTH_TOKEN_TTL_MINUTES", "480"))
    bootstrap_admin_username: str = os.getenv("SOVEREIGN_BOOTSTRAP_ADMIN_USERNAME", "admin")
    bootstrap_admin_password: str = os.getenv("SOVEREIGN_BOOTSTRAP_ADMIN_PASSWORD", "change-me-now")


SETTINGS = Settings()
