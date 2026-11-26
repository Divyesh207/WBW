"""Accounts and bearer-token authentication (standard library only).

Passwords are stored as salted PBKDF2-SHA256 hashes. Login returns a random
token; only its SHA-256 hash is stored, so a leaked database does not reveal
usable tokens. Tokens expire after TOKEN_DAYS.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.marketplace import AuthToken, SupplierProfile, User

ITERATIONS = 200_000
TOKEN_DAYS = 14


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


def issue_token(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.execute(delete(AuthToken).where(AuthToken.expires_at < _utcnow()))  # housekeeping
    db.add(AuthToken(token_hash=_token_hash(token), user_id=user.id, expires_at=_utcnow() + timedelta(days=TOKEN_DAYS)))
    db.commit()
    return token


def revoke_token(db: Session, token: str) -> None:
    db.execute(delete(AuthToken).where(AuthToken.token_hash == _token_hash(token)))
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
    row = db.get(AuthToken, _token_hash(token))
    if row is None or row.expires_at < _utcnow():
        return None
    return db.get(User, row.user_id)


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in to use the marketplace.")
    return user


def require_manufacturer(user: User = Depends(current_user)) -> User:
    if user.role != "manufacturer":
        raise HTTPException(status_code=403, detail="This action is only available to manufacturer accounts.")
    return user


def require_supplier(user: User = Depends(current_user)) -> SupplierProfile:
    if user.role != "supplier" or user.supplier_profile is None:
        raise HTTPException(status_code=403, detail="This action is only available to supplier accounts.")
    return user.supplier_profile
