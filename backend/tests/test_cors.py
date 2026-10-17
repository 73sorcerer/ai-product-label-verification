"""Local dev: frontend :3000 calls the API :8000, so the billing cookie needs credentialed CORS."""


def test_cors_allows_credentials_for_dev_origin(client):
    r = client.options("/billing/status", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert r.headers.get("access-control-allow-credentials") == "true"


def test_cors_rejects_unknown_origin(client):
    r = client.options("/billing/status", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") is None
