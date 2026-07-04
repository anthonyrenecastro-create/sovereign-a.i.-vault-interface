from __future__ import annotations

from pathlib import Path
import subprocess
import os
import platform
import shutil

from fastapi import APIRouter, Header, HTTPException

from app.models import ListFilesRequest, ReadFileRequest, ShellRequest, AdminTokenRequest
from app.security import authorize_role, require_admin_token
from app.config import SETTINGS


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/verify")
def verify_admin(payload: AdminTokenRequest | None = None, authorization: str | None = Header(default=None)) -> dict:
    if authorization:
        authorize_role({"operator", "admin"}, authorization=authorization)
        return {"status": "ok", "auth": "bearer"}

    if payload is None:
        raise HTTPException(status_code=400, detail="Token body is required when Authorization header is not provided")

    require_admin_token(payload.token)
    return {"status": "ok"}


@router.post("/files/list")
def list_files(
    payload: ListFilesRequest,
    token: str | None = None,
    authorization: str | None = Header(default=None),
) -> dict:
    authorize_role({"operator", "admin"}, authorization=authorization, legacy_token=token)
    base = Path(payload.path).expanduser().resolve()
    if not base.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    items = []
    for child in sorted(base.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        items.append(
            {
                "name": child.name,
                "path": str(child),
                "is_dir": child.is_dir(),
            }
        )

    return {"path": str(base), "items": items}


@router.post("/files/read")
def read_file(
    payload: ReadFileRequest,
    token: str | None = None,
    authorization: str | None = Header(default=None),
) -> dict:
    authorize_role({"operator", "admin"}, authorization=authorization, legacy_token=token)
    target = Path(payload.path).expanduser().resolve()
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    data = target.read_bytes()[: payload.max_bytes]
    return {
        "path": str(target),
        "content": data.decode("utf-8", errors="replace"),
        "truncated": target.stat().st_size > payload.max_bytes,
    }


@router.post("/shell/run")
def run_shell(
    payload: ShellRequest,
    token: str | None = None,
    authorization: str | None = Header(default=None),
) -> dict:
    authorize_role({"operator", "admin"}, authorization=authorization, legacy_token=token)
    try:
        completed = subprocess.run(
            payload.command,
            shell=True,
            text=True,
            capture_output=True,
            timeout=payload.timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=408, detail=f"Command timed out after {payload.timeout_seconds}s") from exc

    return {
        "exit_code": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


@router.get("/diagnostics")
def diagnostics(
    token: str | None = None,
    authorization: str | None = Header(default=None),
) -> dict:
    authorize_role({"operator", "admin"}, authorization=authorization, legacy_token=token)

    mem_total_kb = 0
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as fp:
            for line in fp:
                if line.startswith("MemTotal:"):
                    mem_total_kb = int(line.split()[1])
                    break
    except Exception:
        mem_total_kb = 0

    disk = shutil.disk_usage(SETTINGS.data_dir)

    ollama_status = {
        "reachable": False,
        "list_exit_code": None,
        "list_output": "",
    }
    try:
        completed = subprocess.run(
            "ollama list",
            shell=True,
            text=True,
            capture_output=True,
            timeout=8,
            check=False,
        )
        ollama_status["list_exit_code"] = completed.returncode
        ollama_status["list_output"] = completed.stdout[-4000:]
        ollama_status["reachable"] = completed.returncode == 0
    except Exception as exc:
        ollama_status["list_output"] = str(exc)

    return {
        "status": "ok",
        "system": {
            "hostname": platform.node(),
            "platform": platform.platform(),
            "cpu_count": os.cpu_count() or 1,
            "mem_total_gb": round(mem_total_kb / 1024 / 1024, 2),
        },
        "storage": {
            "data_dir": str(Path(SETTINGS.data_dir).resolve()),
            "total_gb": round(disk.total / 1024 / 1024 / 1024, 2),
            "free_gb": round(disk.free / 1024 / 1024 / 1024, 2),
        },
        "ollama": ollama_status,
        "runtime": {
            "host": SETTINGS.host,
            "port": SETTINGS.port,
            "hardware_tier": os.getenv("SOVEREIGN_HW_TIER", "micro-pc"),
            "memory_mode": int(os.getenv("SOVEREIGN_MIN_MEMORY_MODE", "0")),
            "assistant_profiles_file": os.getenv("SOVEREIGN_ASSISTANT_PROFILES_FILE", ""),
            "local_docs_dir": os.getenv("SOVEREIGN_LOCAL_DOCS_DIR", ""),
            "embedding_model": SETTINGS.model_embedding,
            "default_model": SETTINGS.model_default,
            "reasoning_model": SETTINGS.model_reasoning,
            "coder_model": SETTINGS.model_coder,
            "fast_model": SETTINGS.model_fast,
        },
    }
