from __future__ import annotations

from fastapi import APIRouter, Header

from app.models import CreateUserRequest, LoginRequest, ResetPasswordRequest, UpdateUserRequest
from app.security import authorize_role, get_current_user_from_authorization
from app.services.auth_service import auth_service


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest) -> dict:
    user = auth_service.authenticate(payload.username, payload.password)
    token, expires_in = auth_service.issue_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": {
            "username": user.username,
            "role": user.role,
        },
    }


@router.get("/me")
def me(authorization: str | None = Header(default=None)) -> dict:
    user = get_current_user_from_authorization(authorization)
    return {
        "username": user.username,
        "role": user.role,
        "disabled": user.disabled,
    }


@router.get("/users")
def list_users(authorization: str | None = Header(default=None)) -> dict:
    authorize_role({"admin"}, authorization=authorization)
    return {"users": auth_service.list_users()}


@router.get("/audit")
def list_audit(authorization: str | None = Header(default=None), limit: int = 200) -> dict:
    authorize_role({"admin"}, authorization=authorization)
    return {"events": auth_service.list_audit_events(limit=limit)}


@router.post("/users")
def create_user(payload: CreateUserRequest, authorization: str | None = Header(default=None)) -> dict:
    actor = authorize_role({"admin"}, authorization=authorization)
    user = auth_service.create_user(
        payload.username,
        payload.password,
        payload.role,
        actor_username=str(actor.get("username", "unknown")),
        actor_role=str(actor.get("role", "admin")),
    )
    return {"status": "ok", "user": user}


@router.patch("/users/{username}")
def update_user(username: str, payload: UpdateUserRequest, authorization: str | None = Header(default=None)) -> dict:
    actor = authorize_role({"admin"}, authorization=authorization)
    user = auth_service.update_user(
        username=username,
        role=payload.role,
        disabled=payload.disabled,
        actor_username=str(actor.get("username", "unknown")),
        actor_role=str(actor.get("role", "admin")),
    )
    return {"status": "ok", "user": user}


@router.post("/users/{username}/password")
def reset_password(username: str, payload: ResetPasswordRequest, authorization: str | None = Header(default=None)) -> dict:
    actor = authorize_role({"admin"}, authorization=authorization)
    user = auth_service.reset_password(
        username=username,
        password=payload.password,
        actor_username=str(actor.get("username", "unknown")),
        actor_role=str(actor.get("role", "admin")),
    )
    return {"status": "ok", "user": user}
