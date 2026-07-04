from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


Role = Literal["user", "assistant", "system"]


class ChatTurn(BaseModel):
    role: Role
    content: str


class ChatRequest(BaseModel):
    assistant_id: str = Field(min_length=1)
    message: str = Field(min_length=1)
    history: list[ChatTurn] = Field(default_factory=list)
    use_retrieval: bool = True
    max_context_chunks: int = 4
    retrieval_source_types: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    assistant_id: str
    model: str
    response: str
    retrieved_context: list[str] = Field(default_factory=list)


class IndexDocumentRequest(BaseModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)
    source_type: str = "manual"
    source_id: str = ""


class IndexPathRequest(BaseModel):
    path: str = Field(min_length=1)
    source_type: str = "file"
    source_id: str = ""


class IndexSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=6, ge=1, le=25)
    mode: Literal["semantic", "keyword"] = "semantic"
    source_types: list[str] = Field(default_factory=list)


class ListFilesRequest(BaseModel):
    path: str = "."


class ReadFileRequest(BaseModel):
    path: str
    max_bytes: int = 32768


class ShellRequest(BaseModel):
    command: str
    timeout_seconds: int = 20


class AdminTokenRequest(BaseModel):
    token: str


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=8)
    role: str = Field(min_length=1)


class UpdateUserRequest(BaseModel):
    role: str | None = None
    disabled: bool | None = None


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8)
