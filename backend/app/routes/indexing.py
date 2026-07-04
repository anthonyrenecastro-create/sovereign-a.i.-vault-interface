from __future__ import annotations

from fastapi import APIRouter, File, Form, UploadFile

from app.models import IndexDocumentRequest, IndexPathRequest, IndexSearchRequest
from app.services.document_parser import parse_uploaded_file
from app.services.retrieval import retriever


router = APIRouter(prefix="/api/index", tags=["indexing"])


@router.post("/document")
def index_document(payload: IndexDocumentRequest) -> dict:
    result = retriever.add_document(
        payload.title,
        payload.content,
        source_type=payload.source_type,
        source_id=payload.source_id,
    )
    return {
        "status": "ok",
        "chunks_added": result.chunks_added,
        "deduplicated": result.deduplicated,
        "fingerprint": result.fingerprint,
        "total_chunks": result.total_chunks,
        "source_type": result.source_type,
        "source_id": result.source_id,
        "indexed_at": result.indexed_at,
    }


@router.post("/path")
def index_path(payload: IndexPathRequest) -> dict:
    result = retriever.add_path(
        payload.path,
        source_type=payload.source_type,
        source_id=payload.source_id,
    )
    return {
        "status": "ok",
        "chunks_added": result.chunks_added,
        "deduplicated": result.deduplicated,
        "fingerprint": result.fingerprint,
        "total_chunks": result.total_chunks,
        "source_type": result.source_type,
        "source_id": result.source_id,
        "indexed_at": result.indexed_at,
    }


@router.post("/upload")
async def index_upload(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    source_type: str = Form(default="upload"),
    source_id: str = Form(default=""),
) -> dict:
    raw = await file.read()
    parsed_text, parsed_type = parse_uploaded_file(file.filename or "uploaded", raw)

    effective_title = title.strip() or (file.filename or "uploaded-document")
    effective_source_id = source_id.strip() or (file.filename or "uploaded-document")

    result = retriever.add_document(
        effective_title,
        parsed_text,
        source_type=source_type,
        source_id=effective_source_id,
    )

    return {
        "status": "ok",
        "parsed_type": parsed_type,
        "parsed_chars": len(parsed_text),
        "chunks_added": result.chunks_added,
        "deduplicated": result.deduplicated,
        "fingerprint": result.fingerprint,
        "total_chunks": result.total_chunks,
        "source_type": result.source_type,
        "source_id": result.source_id,
        "indexed_at": result.indexed_at,
    }


@router.get("/stats")
def index_stats() -> dict:
    return retriever.stats()


@router.post("/search")
def index_search(payload: IndexSearchRequest) -> dict:
    if payload.mode == "keyword":
        chunks = retriever.search_keyword(
            payload.query,
            top_k=payload.top_k,
            source_types=payload.source_types,
        )
    else:
        chunks = retriever.search(
            payload.query,
            top_k=payload.top_k,
            source_types=payload.source_types,
        )

    return {
        "status": "ok",
        "mode": payload.mode,
        "query": payload.query,
        "count": len(chunks),
        "results": [
            {
                "title": chunk.title,
                "content": chunk.content,
                "source_type": chunk.source_type,
                "source_id": chunk.source_id,
                "indexed_at": chunk.indexed_at,
                "fingerprint": chunk.fingerprint,
            }
            for chunk in chunks
        ],
    }
