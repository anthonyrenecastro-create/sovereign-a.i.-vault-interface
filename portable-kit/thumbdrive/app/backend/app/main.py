from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import SETTINGS
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.indexing import router as indexing_router
from app.routes.admin import router as admin_router


Path(SETTINGS.data_dir).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Sovereign Vault Local Intelligence API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "ollama": SETTINGS.ollama_base_url,
    }


app.include_router(chat_router)
app.include_router(indexing_router)
app.include_router(admin_router)
app.include_router(auth_router)
