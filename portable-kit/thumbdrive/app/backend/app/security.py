from __future__ import annotations

from dataclasses import asdict

from fastapi import HTTPException, status

from app.config import SETTINGS
from app.services.auth_service import AuthUser, auth_service


def require_admin_token(token: str) -> None:
    if token != SETTINGS.admin_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin token.",
        )


def get_current_user_from_authorization(authorization: str | None) -> AuthUser:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization must be Bearer <token>",
        )

    return auth_service.parse_token(token.strip())


def authorize_role(
    allowed_roles: set[str],
    authorization: str | None,
    legacy_token: str | None = None,
) -> dict:
    if authorization:
        user = get_current_user_from_authorization(authorization)
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not allowed for this operation",
            )
        return asdict(user)

    if legacy_token:
        require_admin_token(legacy_token)
        if "admin" in allowed_roles:
            return {"username": "legacy-token", "role": "admin", "disabled": False}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing valid authentication",
    )
