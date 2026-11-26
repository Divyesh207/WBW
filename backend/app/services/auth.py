"""Accounts and bearer-token authentication (standard library only).

Passwords are stored as salted PBKDF2-SHA256 hashes.

Sign-in returns a *signed* token (payload + HMAC-SHA256 signature) that carries
the user's email and an expiry time. Any server instance holding the same
secret can verify it without a database lookup, so a session survives server
restarts and serverless platforms (such as Vercel) where each instance starts
with its own temporary database. Signed-out tokens are kept on a small
revocation list until they expire.

Set WBW_SECRET_KEY in production. Without it a fixed development key is used,
which keeps local and demo deployments working but must not be used for real data.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.marketplace import AuthToken, SupplierProfile, User

ITERATIONS = 200_000
TOKEN_DAYS = 14

_DEV_SECRET = "wbw-development-secret-change-me"
SECRET_KEY = os.getenv("WBW_SECRET_KEY") or _DEV_SECRET
if SECRET_KEY == _DEV_SECRET:
    logging.getLogger("wbw.auth").warning("WBW_SECRET_KEY is not set; using the development signing key.")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), ITERATIONS).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations)).hex()
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(check, digest)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: str) -> str:
    return _b64(hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).digest())


def issue_token(db: Session, user: User) -> str:
    """Signed token: base64url(JSON payload) + "." + signature. Nothing is stored."""
    expires = _utcnow() + timedelta(days=TOKEN_DAYS)
    payload = _b64(json.dumps({"sub": user.email, "exp": int(expires.replace(tzinfo=timezone.utc).timestamp()), "jti": secrets.token_hex(8)}, separators=(",", ":")).encode())
    return f"{payload}.{_sign(payload)}"


def decode_token(token: str) -> dict | None:
    """Return the payload of a valid, unexpired token, or None."""
    try:
        payload, signature = token.split(".")
        if not hmac.compare_digest(signature, _sign(payload)):
            return None
        data = json.loads(_unb64(payload))
        if data["exp"] < datetime.now(timezone.utc).timestamp():
            return None
        return data
    except (ValueError, KeyError, TypeError):
        return None


def revoke_token(db: Session, token: str) -> None:
    """Sign-out: remember the token as revoked until it would have expired anyway."""
    data = decode_token(token)
    if data is None:
        return
    db.execute(delete(AuthToken).where(AuthToken.expires_at < _utcnow()))  # housekeeping
    if db.get(AuthToken, _token_hash(token)) is None:
        user = db.scalar(select(User).where(User.email == data["sub"]))
        db.add(AuthToken(token_hash=_token_hash(token), user_id=user.id if user else 0, expires_at=datetime.fromtimestamp(data["exp"], timezone.utc).replace(tzinfo=None)))
    db.commit()


def create_user(
    db: Session,
    *,
    email: str,
    name: str,
    password: str,
    role: str,
    organisation: str = "",
    company_name: str = "",
    city: str = "",
    state: str = "",
    supplier_type: str = "recycler",
    is_demo: bool = False,
) -> User:
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(
        email=email,
        name=name,
        organisation=organisation or company_name,
        role=role,
        password_hash=hash_password(password),
        is_demo=is_demo,
    )
    db.add(user)
    db.flush()
    if role == "supplier":
        db.add(
            SupplierProfile(
                user_id=user.id,
                company_name=company_name,
                city=city,
                state=state,
                contact_email=email,
                supplier_type=supplier_type,
            )
        )
    db.commit()
    db.refresh(user)
    return user


def bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    return token.strip() if scheme.lower() == "bearer" and token.strip() else None


def optional_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User | None:
    token = bearer_token(authorization)
    if not token:
        return None
    data = decode_token(token)
    if data is None or db.get(AuthToken, _token_hash(token)) is not None:  # invalid, expired or signed out
        return None
    return db.scalar(select(User).where(User.email == data["sub"]))


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Your session has ended. Please sign in again.")
    return user


def require_manufacturer(user: User = Depends(current_user)) -> User:
    if user.role != "manufacturer":
        raise HTTPException(status_code=403, detail="This action is only available to manufacturer accounts.")
    return user


def require_supplier(user: User = Depends(current_user)) -> SupplierProfile:
    if user.role != "supplier" or user.supplier_profile is None:
        raise HTTPException(status_code=403, detail="This action is only available to supplier accounts.")
    return user.supplier_profile
