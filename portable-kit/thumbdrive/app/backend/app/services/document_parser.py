from __future__ import annotations

import csv
from io import BytesIO, StringIO
from pathlib import Path

from docx import Document
from pypdf import PdfReader


def parse_uploaded_file(filename: str, data: bytes) -> tuple[str, str]:
    suffix = Path(filename or "uploaded").suffix.lower()

    if suffix == ".pdf":
        return _parse_pdf(data), "pdf"
    if suffix == ".docx":
        return _parse_docx(data), "docx"
    if suffix == ".csv":
        return _parse_csv(data), "csv"

    text = data.decode("utf-8", errors="replace")
    return text, "text"


def _parse_pdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    chunks: list[str] = []
    for page in reader.pages:
        extracted = page.extract_text() or ""
        if extracted.strip():
            chunks.append(extracted.strip())
    return "\n\n".join(chunks).strip()


def _parse_docx(data: bytes) -> str:
    doc = Document(BytesIO(data))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
    return "\n\n".join(paragraphs).strip()


def _parse_csv(data: bytes) -> str:
    decoded = data.decode("utf-8", errors="replace")
    reader = csv.reader(StringIO(decoded))
    lines: list[str] = []
    for row in reader:
        cleaned = [cell.strip() for cell in row]
        if any(cleaned):
            lines.append(" | ".join(cleaned))
    return "\n".join(lines).strip()
