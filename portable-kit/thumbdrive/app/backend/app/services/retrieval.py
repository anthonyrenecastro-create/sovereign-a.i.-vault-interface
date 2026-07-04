from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from typing import Any

import httpx

from app.config import SETTINGS


@dataclass
class Chunk:
    title: str
    content: str
    source_type: str
    source_id: str
    indexed_at: str
    fingerprint: str
    vector: list[float] | None


@dataclass
class IndexResult:
    chunks_added: int
    deduplicated: bool
    fingerprint: str
    total_chunks: int
    source_type: str
    source_id: str
    indexed_at: str


class LocalRetriever:
    def __init__(self) -> None:
        self._chunks: list[Chunk] = []
        self._fingerprints: set[str] = set()
        self._state_file = Path(SETTINGS.data_dir) / "retrieval_state.json"
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._load_state()

    def _normalize(self, text: str) -> str:
        return re.sub(r"\s+", " ", text.strip().lower())

    def _build_fingerprint(self, title: str, content: str) -> str:
        normalized_title = self._normalize(title)
        normalized_content = self._normalize(content)
        payload = f"{normalized_title}\n{normalized_content}".encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def _save_state(self) -> None:
        state = {
            "fingerprints": sorted(self._fingerprints),
            "chunks": [
                {
                    "title": c.title,
                    "content": c.content,
                    "source_type": c.source_type,
                    "source_id": c.source_id,
                    "indexed_at": c.indexed_at,
                    "fingerprint": c.fingerprint,
                    "vector": c.vector,
                }
                for c in self._chunks
            ],
        }
        self._state_file.write_text(json.dumps(state, ensure_ascii=True), encoding="utf-8")

    def _load_state(self) -> None:
        if not self._state_file.exists():
            return

        try:
            raw = json.loads(self._state_file.read_text(encoding="utf-8"))
            loaded_chunks = raw.get("chunks", [])
            loaded_fingerprints = raw.get("fingerprints", [])

            if isinstance(loaded_chunks, list):
                for item in loaded_chunks:
                    if not isinstance(item, dict):
                        continue
                    title = str(item.get("title", ""))
                    content = str(item.get("content", ""))
                    source_type = str(item.get("source_type", "legacy"))
                    source_id = str(item.get("source_id", ""))
                    indexed_at = str(item.get("indexed_at", ""))
                    fingerprint = str(item.get("fingerprint", ""))
                    vector = self._coerce_vector(item.get("vector"))

                    if not indexed_at:
                        indexed_at = datetime.now(timezone.utc).isoformat()

                    if not fingerprint and title and content:
                        fingerprint = self._build_fingerprint(title=title, content=content)

                    if title and content:
                        self._chunks.append(
                            Chunk(
                                title=title,
                                content=content,
                                source_type=source_type,
                                source_id=source_id,
                                indexed_at=indexed_at,
                                fingerprint=fingerprint,
                                vector=vector,
                            )
                        )

            if isinstance(loaded_fingerprints, list):
                for fp in loaded_fingerprints:
                    if isinstance(fp, str) and fp:
                        self._fingerprints.add(fp)
        except Exception:
            self._chunks = []
            self._fingerprints = set()

    def _coerce_vector(self, value: Any) -> list[float] | None:
        if not isinstance(value, list):
            return None

        vector: list[float] = []
        for item in value:
            if isinstance(item, (int, float)):
                vector.append(float(item))
        if not vector:
            return None
        return vector

    def _tokenize(self, text: str) -> set[str]:
        return set(t for t in re.findall(r"\w+", text.lower()) if len(t) > 2)

    def _embed_text(self, text: str) -> list[float] | None:
        clean = text.strip()
        if not clean:
            return None

        payload = {
            "model": SETTINGS.model_embedding,
            "prompt": clean,
        }

        try:
            with httpx.Client(timeout=20) as client:
                response = client.post(f"{SETTINGS.ollama_base_url.rstrip('/')}/api/embeddings", json=payload)
                response.raise_for_status()
                data = response.json()

            if isinstance(data, dict):
                if isinstance(data.get("embedding"), list):
                    return self._coerce_vector(data.get("embedding"))
                if isinstance(data.get("data"), list) and data.get("data"):
                    first = data["data"][0]
                    if isinstance(first, dict):
                        return self._coerce_vector(first.get("embedding"))
        except Exception:
            return None

        return None

    def _cosine_similarity(self, a: list[float], b: list[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0

        dot = 0.0
        norm_a = 0.0
        norm_b = 0.0
        for ai, bi in zip(a, b):
            dot += ai * bi
            norm_a += ai * ai
            norm_b += bi * bi

        if norm_a <= 0 or norm_b <= 0:
            return 0.0

        return dot / ((norm_a ** 0.5) * (norm_b ** 0.5))

    def add_document(self, title: str, content: str, source_type: str = "manual", source_id: str = "") -> IndexResult:
        fingerprint = self._build_fingerprint(title=title, content=content)
        normalized_source_type = source_type.strip().lower() or "manual"
        normalized_source_id = source_id.strip()
        indexed_at = datetime.now(timezone.utc).isoformat()

        if fingerprint in self._fingerprints:
            return IndexResult(
                chunks_added=0,
                deduplicated=True,
                fingerprint=fingerprint,
                total_chunks=len(self._chunks),
                source_type=normalized_source_type,
                source_id=normalized_source_id,
                indexed_at=indexed_at,
            )

        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]
        for paragraph in paragraphs:
            vector = self._embed_text(paragraph)
            self._chunks.append(
                Chunk(
                    title=title,
                    content=paragraph,
                    source_type=normalized_source_type,
                    source_id=normalized_source_id,
                    indexed_at=indexed_at,
                    fingerprint=fingerprint,
                    vector=vector,
                )
            )

        self._fingerprints.add(fingerprint)
        self._save_state()

        return IndexResult(
            chunks_added=len(paragraphs),
            deduplicated=False,
            fingerprint=fingerprint,
            total_chunks=len(self._chunks),
            source_type=normalized_source_type,
            source_id=normalized_source_id,
            indexed_at=indexed_at,
        )

    def add_path(self, path: str, source_type: str = "file", source_id: str = "") -> IndexResult:
        target = Path(path)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(f"Path not found or not a file: {path}")
        text = target.read_text(encoding="utf-8", errors="ignore")
        effective_source_id = source_id.strip() or str(target.resolve())
        return self.add_document(target.name, text, source_type=source_type, source_id=effective_source_id)

    def stats(self) -> dict:
        source_counts: dict[str, int] = {}
        vectorized_chunks = 0
        for chunk in self._chunks:
            source_counts[chunk.source_type] = source_counts.get(chunk.source_type, 0) + 1
            if chunk.vector:
                vectorized_chunks += 1

        return {
            "total_chunks": len(self._chunks),
            "total_documents": len(self._fingerprints),
            "vectorized_chunks": vectorized_chunks,
            "embedding_model": SETTINGS.model_embedding,
            "state_file": str(self._state_file),
            "source_counts": source_counts,
        }

    def search(self, query: str, top_k: int = 4, source_types: list[str] | None = None) -> list[Chunk]:
        query_terms = self._tokenize(query)
        if not query_terms:
            return []

        allowed_source_types: set[str] | None = None
        if source_types:
            allowed_source_types = {s.strip().lower() for s in source_types if s.strip()}

        query_vector = self._embed_text(query)

        scored: list[tuple[float, Chunk]] = []
        for chunk in self._chunks:
            if allowed_source_types and chunk.source_type not in allowed_source_types:
                continue

            chunk_terms = self._tokenize(chunk.content)
            lexical_overlap = len(query_terms.intersection(chunk_terms))
            lexical_score = lexical_overlap / max(len(query_terms), 1)

            vector_score = 0.0
            if query_vector and chunk.vector:
                vector_score = max(0.0, self._cosine_similarity(query_vector, chunk.vector))

            final_score = (0.3 * lexical_score) + (0.7 * vector_score if query_vector else lexical_score)
            if final_score > 0:
                scored.append((final_score, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [chunk for _, chunk in scored[:top_k]]

    def search_keyword(self, query: str, top_k: int = 6, source_types: list[str] | None = None) -> list[Chunk]:
        query_terms = self._tokenize(query)
        if not query_terms:
            return []

        allowed_source_types: set[str] | None = None
        if source_types:
            allowed_source_types = {s.strip().lower() for s in source_types if s.strip()}

        scored: list[tuple[float, Chunk]] = []
        for chunk in self._chunks:
            if allowed_source_types and chunk.source_type not in allowed_source_types:
                continue

            chunk_terms = self._tokenize(chunk.content)
            overlap = len(query_terms.intersection(chunk_terms))
            if overlap <= 0:
                continue

            score = overlap / max(len(query_terms), 1)
            scored.append((score, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [chunk for _, chunk in scored[:top_k]]


retriever = LocalRetriever()
