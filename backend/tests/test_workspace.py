"""Signed workspace cookie (ADR 0004).  OWNER: Amzad (built by Tray, Oct 17)"""
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import workspace

SECRET = "test-secret"


def test_sign_verify_roundtrip():
    assert workspace.verify(workspace.sign("abc123", SECRET), SECRET) == "abc123"


def test_tampered_id_rejected():
    cookie = workspace.sign("abc123", SECRET)
    assert workspace.verify("abd123" + cookie[6:], SECRET) is None


def test_tampered_signature_rejected():
    cookie = workspace.sign("abc123", SECRET)
    flipped = cookie[:-1] + ("0" if cookie[-1] != "0" else "1")
    assert workspace.verify(flipped, SECRET) is None


def test_wrong_secret_rejected():
    assert workspace.verify(workspace.sign("abc123", SECRET), "other-secret") is None


def test_missing_or_malformed_cookie_is_none():
    for bad in (None, "", "abc", ".", "abc.", ".sig"):
        assert workspace.verify(bad, SECRET) is None


def _app():
    app = FastAPI()

    @app.get("/who")
    def who(workspace_id: str = Depends(workspace.get_workspace_id)):
        return {"workspace_id": workspace_id}

    return app


def test_dependency_sets_cookie_once(monkeypatch):
    monkeypatch.setenv("WORKSPACE_SECRET", SECRET)
    monkeypatch.delenv("VERCEL", raising=False)
    client = TestClient(_app())
    first = client.get("/who")
    set_cookie = first.headers.get("set-cookie", "")
    assert workspace.COOKIE in set_cookie
    assert "httponly" in set_cookie.lower()
    assert "samesite=lax" in set_cookie.lower()
    second = client.get("/who")  # TestClient keeps the cookie
    assert second.json()["workspace_id"] == first.json()["workspace_id"]
    assert "set-cookie" not in second.headers


def test_tampered_cookie_gets_a_fresh_workspace(monkeypatch):
    monkeypatch.setenv("WORKSPACE_SECRET", SECRET)
    client = TestClient(_app())
    client.cookies.set(workspace.COOKIE, "victimid." + "0" * 64)
    r = client.get("/who")
    assert r.json()["workspace_id"] != "victimid"
    assert workspace.COOKIE in r.headers.get("set-cookie", "")


def test_secure_flag_on_vercel(monkeypatch):
    monkeypatch.setenv("WORKSPACE_SECRET", SECRET)
    monkeypatch.setenv("VERCEL", "1")
    r = TestClient(_app(), base_url="https://testserver").get("/who")
    assert "secure" in r.headers.get("set-cookie", "").lower()


def test_missing_secret_on_vercel_is_503(monkeypatch):
    monkeypatch.delenv("WORKSPACE_SECRET", raising=False)
    monkeypatch.setenv("VERCEL", "1")
    assert TestClient(_app()).get("/who").status_code == 503
