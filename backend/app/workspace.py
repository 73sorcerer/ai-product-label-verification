"""Signed workspace cookie: who owns a subscription until accounts exist (ADR 0004).

OWNER: Amzad (built by Tray, Oct 17). After Clerk lands, replace get_workspace_id() with the
Clerk org_id; billing code and the subscriptions table don't change.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import uuid

from fastapi import HTTPException, Request, Response

COOKIE = "lg_workspace"
MAX_AGE = 60 * 60 * 24 * 365  # 1 year
_DEV_SECRET = "dev-only-secret"


def sign(workspace_id: str, secret: str) -> str:
    digest = hmac.new(secret.encode(), workspace_id.encode(), hashlib.sha256).hexdigest()
    return f"{workspace_id}.{digest}"


def verify(cookie: str | None, secret: str) -> str | None:
    """The workspace ID if the signature is valid, else None (never raises)."""
    if not cookie or "." not in cookie:
        return None
    workspace_id, _, digest = cookie.rpartition(".")
    if not workspace_id or not digest:
        return None
    expected = sign(workspace_id, secret).rpartition(".")[2]
    return workspace_id if hmac.compare_digest(expected, digest) else None


def _secret() -> str:
    secret = os.getenv("WORKSPACE_SECRET")
    if secret:
        return secret
    if os.getenv("VERCEL"):  # never sign with a known secret in a deployment
        raise HTTPException(503, "Billing is not configured")
    return _DEV_SECRET


def get_workspace_id(request: Request, response: Response) -> str:
    """FastAPI dependency: the caller's verified workspace, or a new one (cookie set)."""
    secret = _secret()
    existing = verify(request.cookies.get(COOKIE), secret)
    if existing:
        return existing
    workspace_id = uuid.uuid4().hex
    response.set_cookie(
        COOKIE,
        sign(workspace_id, secret),
        max_age=MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=bool(os.getenv("VERCEL")),
        path="/",
    )
    return workspace_id
