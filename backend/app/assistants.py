from __future__ import annotations

import json
import os
from pathlib import Path


DEFAULT_ASSISTANT_PROFILES = {
    "re-genesis": {
        "id": "re-genesis",
        "name": "Re-Genesis",
        "description": "Primary multi-tool knowledge workspace for chat, synthesis, and planning.",
        "model": "reasoning",
        "system_prompt": (
            "You are Re-Genesis, the primary Sovereign Vault intelligence interface. "
            "Be practical, clear, and grounded in available local context. "
            "Answer with enough depth to be useful: use short sections, explicit steps, and concrete outcomes when appropriate. "
            "When retrieval context is provided, prioritize it, synthesize it, and cite which document title it came from. "
            "If a request is ambiguous, state the assumption before proceeding."
        ),
        "privileged": False,
    },
    "aetherium": {
        "id": "aetherium",
        "name": "Aetherium",
        "description": "Lightweight dashboard and insight mode for concise status and trend framing.",
        "model": "fast",
        "system_prompt": (
            "You are Aetherium. Respond with concise insight summaries, status dashboards, and key metrics framing. "
            "Use brief sections and prioritize clarity."
        ),
        "privileged": False,
    },
    "amaterasu": {
        "id": "amaterasu",
        "name": "Amaterasu",
        "description": "Document-centered reasoning and parsing workflows.",
        "model": "reasoning",
        "system_prompt": (
            "You are Amaterasu. You excel at document analysis, comparison, extraction, and careful reasoning. "
            "Respond in a structured format with sections such as summary, key findings, extracted facts, gaps, and next steps when useful. "
            "Prefer direct quotations or explicit references to the provided local document context. "
            "If uncertainty exists, state it and propose verifiable next steps."
        ),
        "privileged": False,
    },
    "powercoder-z": {
        "id": "powercoder-z",
        "name": "PowerCoder-Z",
        "description": "Administrator-grade coding, file operations, and local automation guidance.",
        "model": "coder",
        "system_prompt": (
            "You are PowerCoder-Z. Provide precise technical steps for local coding and system operations. "
            "Prefer complete, operational answers with commands, caveats, and validation steps when relevant. "
            "Never assume remote/cloud services when local alternatives exist."
        ),
        "privileged": True,
    },
}


def _normalize_profile(entry: dict, defaults: dict[str, dict]) -> dict | None:
    assistant_id = str(entry.get("id", "")).strip()
    if not assistant_id:
        return None

    default_entry = defaults.get(assistant_id, {})
    return {
        "id": assistant_id,
        "name": str(entry.get("name") or default_entry.get("name") or assistant_id),
        "description": str(entry.get("description") or default_entry.get("description") or "Sovereign assistant profile."),
        "model": str(entry.get("model") or default_entry.get("model") or "reasoning"),
        "system_prompt": str(
            entry.get("system_prompt")
            or default_entry.get("system_prompt")
            or "You are a local Sovereign Vault assistant. Prefer local context and practical steps."
        ),
        "privileged": bool(entry.get("privileged", default_entry.get("privileged", False))),
    }


def _load_assistant_profiles() -> dict[str, dict]:
    profile_path = os.getenv("SOVEREIGN_ASSISTANT_PROFILES_FILE", "").strip()
    if not profile_path:
        return DEFAULT_ASSISTANT_PROFILES

    try:
        data = json.loads(Path(profile_path).read_text(encoding="utf-8"))
    except Exception:
        return DEFAULT_ASSISTANT_PROFILES

    raw_assistants = data.get("assistants") if isinstance(data, dict) else None
    if not isinstance(raw_assistants, list):
        return DEFAULT_ASSISTANT_PROFILES

    loaded: dict[str, dict] = {}
    for item in raw_assistants:
        if not isinstance(item, dict):
            continue
        normalized = _normalize_profile(item, DEFAULT_ASSISTANT_PROFILES)
        if normalized:
            loaded[normalized["id"]] = normalized

    return loaded or DEFAULT_ASSISTANT_PROFILES


ASSISTANT_PROFILES = _load_assistant_profiles()
