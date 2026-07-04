from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import json
import secrets
from pathlib import Path

from fastapi import HTTPException, status

from app.config import SETTINGS


@dataclass
class AuthUser:
    username: str
    role: str
    disabled: bool = False


class AuthService:
    def __init__(self) -> None:
        self._users_file = Path(SETTINGS.data_dir) / "users.json"
        self._audit_file = Path(SETTINGS.data_dir) / "auth_audit.json"
        self._users_file.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_audit_store()
        self._ensure_bootstrap_admin()

    def _ensure_audit_store(self) -> None:
        if self._audit_file.exists():
            return
        self._audit_file.write_text(json.dumps({"events": []}, ensure_ascii=True, indent=2), encoding="utf-8")

    def _b64url_encode(self, raw: bytes) -> str:
        return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")

    def _b64url_decode(self, value: str) -> bytes:
        padding = "=" * ((4 - len(value) % 4) % 4)
        return base64.urlsafe_b64decode(value + padding)

    def _hash_password(self, password: str, salt: str) -> str:
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            240000,
        )
        return self._b64url_encode(digest)

    def _load_users(self) -> dict:
        if not self._users_file.exists():
            return {"users": []}

        try:
            return json.loads(self._users_file.read_text(encoding="utf-8"))
        except Exception:
            return {"users": []}

    def _save_users(self, data: dict) -> None:
        self._users_file.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")

    def _load_audit(self) -> dict:
        if not self._audit_file.exists():
            return {"events": []}

        try:
            data = json.loads(self._audit_file.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("events"), list):
                return data
        except Exception:
            pass

        return {"events": []}

    def _append_audit_event(
        self,
        action: str,
        actor_username: str,
        actor_role: str,
        target_username: str,
        changes: dict,
    ) -> None:
        log = self._load_audit()
        events = log.get("events", [])
        events.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "action": action,
                "actor": {
                    "username": actor_username,
                    "role": actor_role,
                },
                "target": {
                    "username": target_username,
                },
                "changes": changes,
            }
        )
        log["events"] = events
        self._audit_file.write_text(json.dumps(log, ensure_ascii=True, indent=2), encoding="utf-8")

    def list_audit_events(self, limit: int = 200) -> list[dict]:
        log = self._load_audit()
        events = log.get("events", [])
        if not isinstance(events, list):
            return []
        trimmed = events[-max(1, min(limit, 2000)) :]
        return list(reversed(trimmed))

    def _ensure_bootstrap_admin(self) -> None:
        data = self._load_users()
        users = data.get("users", [])
        if any(u.get("username") == SETTINGS.bootstrap_admin_username for u in users):
            return

        salt = secrets.token_urlsafe(16)
        users.append(
            {
                "username": SETTINGS.bootstrap_admin_username,
                "role": "admin",
                "disabled": False,
                "salt": salt,
                "password_hash": self._hash_password(SETTINGS.bootstrap_admin_password, salt),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        data["users"] = users
        self._save_users(data)
        self._append_audit_event(
            action="bootstrap_admin_created",
            actor_username="system",
            actor_role="system",
            target_username=SETTINGS.bootstrap_admin_username,
            changes={"role": "admin", "disabled": False},
        )

    def authenticate(self, username: str, password: str) -> AuthUser:
        data = self._load_users()
        users = data.get("users", [])
        for user in users:
            if user.get("username") != username:
                continue
            if bool(user.get("disabled", False)):
                break

            salt = str(user.get("salt", ""))
            expected = str(user.get("password_hash", ""))
            actual = self._hash_password(password, salt)
            if hmac.compare_digest(expected, actual):
                return AuthUser(username=username, role=str(user.get("role", "viewer")), disabled=False)
            break

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    def issue_token(self, user: AuthUser) -> tuple[str, int]:
        ttl = SETTINGS.auth_token_ttl_minutes
        expires = datetime.now(timezone.utc) + timedelta(minutes=ttl)
        payload = {
            "sub": user.username,
            "role": user.role,
            "exp": int(expires.timestamp()),
        }

        payload_b64 = self._b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        sig = hmac.new(SETTINGS.auth_secret.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
        token = f"sv1.{payload_b64}.{self._b64url_encode(sig)}"
        return token, ttl * 60

    def parse_token(self, token: str) -> AuthUser:
        parts = token.split(".")
        if len(parts) != 3 or parts[0] != "sv1":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")

        payload_b64 = parts[1]
        sent_sig = parts[2]
        expected_sig = self._b64url_encode(
            hmac.new(SETTINGS.auth_secret.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).digest()
        )

        if not hmac.compare_digest(sent_sig, expected_sig):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")

        try:
            payload = json.loads(self._b64url_decode(payload_b64).decode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload") from exc

        now_ts = int(datetime.now(timezone.utc).timestamp())
        if int(payload.get("exp", 0)) < now_ts:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")

        return AuthUser(
            username=str(payload.get("sub", "")),
            role=str(payload.get("role", "viewer")),
            disabled=False,
        )

    def list_users(self) -> list[dict]:
        data = self._load_users()
        result = []
        for user in data.get("users", []):
            result.append(
                {
                    "username": str(user.get("username", "")),
                    "role": str(user.get("role", "viewer")),
                    "disabled": bool(user.get("disabled", False)),
                    "created_at": str(user.get("created_at", "")),
                }
            )
        return result

    def create_user(self, username: str, password: str, role: str, actor_username: str = "system", actor_role: str = "system") -> dict:
        allowed_roles = {"viewer", "analyst", "operator", "admin"}
        normalized_role = role.strip().lower()
        if normalized_role not in allowed_roles:
            raise HTTPException(status_code=400, detail="Invalid role")

        if len(password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        data = self._load_users()
        users = data.get("users", [])
        if any(u.get("username") == username for u in users):
            raise HTTPException(status_code=409, detail="User already exists")

        salt = secrets.token_urlsafe(16)
        new_user = {
            "username": username,
            "role": normalized_role,
            "disabled": False,
            "salt": salt,
            "password_hash": self._hash_password(password, salt),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        users.append(new_user)
        data["users"] = users
        self._save_users(data)

        self._append_audit_event(
            action="user_created",
            actor_username=actor_username,
            actor_role=actor_role,
            target_username=username,
            changes={"role": normalized_role, "disabled": False},
        )

        return {
            "username": username,
            "role": normalized_role,
            "disabled": False,
            "created_at": new_user["created_at"],
        }

    def _count_enabled_admins(self, users: list[dict]) -> int:
        return sum(1 for user in users if user.get("role") == "admin" and not bool(user.get("disabled", False)))

    def update_user(
        self,
        username: str,
        role: str | None = None,
        disabled: bool | None = None,
        actor_username: str = "system",
        actor_role: str = "system",
    ) -> dict:
        allowed_roles = {"viewer", "analyst", "operator", "admin"}
        data = self._load_users()
        users = data.get("users", [])

        target: dict | None = None
        for user in users:
            if user.get("username") == username:
                target = user
                break

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        previous_role = str(target.get("role", "viewer"))
        previous_disabled = bool(target.get("disabled", False))

        if role is not None:
            normalized_role = role.strip().lower()
            if normalized_role not in allowed_roles:
                raise HTTPException(status_code=400, detail="Invalid role")
            target["role"] = normalized_role

        if disabled is not None:
            target["disabled"] = bool(disabled)

        enabled_admins = self._count_enabled_admins(users)
        if enabled_admins <= 0:
            raise HTTPException(status_code=400, detail="Cannot remove or disable the last enabled admin")

        data["users"] = users
        self._save_users(data)

        role_changed = str(target.get("role", "viewer")) != previous_role
        disabled_changed = bool(target.get("disabled", False)) != previous_disabled
        if role_changed or disabled_changed:
            changes: dict = {}
            if role_changed:
                changes["role"] = {"from": previous_role, "to": str(target.get("role", "viewer"))}
            if disabled_changed:
                changes["disabled"] = {"from": previous_disabled, "to": bool(target.get("disabled", False))}
            self._append_audit_event(
                action="user_updated",
                actor_username=actor_username,
                actor_role=actor_role,
                target_username=username,
                changes=changes,
            )

        return {
            "username": str(target.get("username", "")),
            "role": str(target.get("role", "viewer")),
            "disabled": bool(target.get("disabled", False)),
            "created_at": str(target.get("created_at", "")),
        }

    def reset_password(
        self,
        username: str,
        password: str,
        actor_username: str = "system",
        actor_role: str = "system",
    ) -> dict:
        if len(password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        data = self._load_users()
        users = data.get("users", [])

        target: dict | None = None
        for user in users:
            if user.get("username") == username:
                target = user
                break

        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        salt = secrets.token_urlsafe(16)
        target["salt"] = salt
        target["password_hash"] = self._hash_password(password, salt)

        data["users"] = users
        self._save_users(data)

        self._append_audit_event(
            action="password_reset",
            actor_username=actor_username,
            actor_role=actor_role,
            target_username=username,
            changes={"password": "reset"},
        )

        return {
            "username": str(target.get("username", "")),
            "role": str(target.get("role", "viewer")),
            "disabled": bool(target.get("disabled", False)),
            "created_at": str(target.get("created_at", "")),
        }


auth_service = AuthService()
