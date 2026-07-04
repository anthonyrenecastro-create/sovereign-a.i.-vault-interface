from __future__ import annotations

from fastapi import APIRouter, HTTPException
import httpx

from app.assistants import ASSISTANT_PROFILES
from app.models import ChatRequest, ChatResponse
from app.services.ollama_client import ollama_client
from app.services.retrieval import retriever


router = APIRouter(prefix="/api", tags=["chat"])


@router.get("/assistants")
def get_assistants() -> list[dict]:
    return list(ASSISTANT_PROFILES.values())


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(payload: ChatRequest) -> ChatResponse:
    profile = ASSISTANT_PROFILES.get(payload.assistant_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Assistant mode not found")

    retrieved = []
    extra_context = None
    if payload.use_retrieval:
        chunks = retriever.search(
            payload.message,
            top_k=payload.max_context_chunks,
            source_types=payload.retrieval_source_types,
        )
        if chunks:
            retrieved = [
                f"[{chunk.title} | source:{chunk.source_type} | indexed:{chunk.indexed_at}] {chunk.content}"
                for chunk in chunks
            ]
            extra_context = "\n\n".join(retrieved)

    try:
        content, model = await ollama_client.chat(
            profile_model=profile["model"],
            system_prompt=profile["system_prompt"],
            history=payload.history,
            user_message=payload.message,
            extra_context=extra_context,
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Ollama is unreachable. Start Ollama and ensure OLLAMA_BASE_URL is correct "
                f"(current: {ollama_client.base_url})."
            ),
        ) from exc
    except httpx.HTTPStatusError as exc:
        body = exc.response.text.strip()
        raise HTTPException(
            status_code=502,
            detail=f"Ollama returned {exc.response.status_code}: {body[:500]}",
        ) from exc

    return ChatResponse(
        assistant_id=profile["id"],
        model=model,
        response=content,
        retrieved_context=retrieved,
    )
