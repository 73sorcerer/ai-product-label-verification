"""API tests.  OWNER: Amzad (stub; replace the 501 checks as routes are implemented)."""
from pathlib import Path

SAMPLE = Path(__file__).resolve().parents[2] / "data" / "sample_labels" / "granola_correct.png"


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_ocr_endpoint_returns_text(client):
    r = client.post("/ocr", files={"image": ("label.png", SAMPLE.read_bytes(), "image/png")})
    assert r.status_code == 200
    assert "Sunrise Farms" in r.json()["text"]


def test_ocr_endpoint_rejects_non_image(client):
    r = client.post("/ocr", files={"image": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 422


def test_unimplemented_routes_are_501(client):
    # TODO(Amzad): delete this once the routes are implemented.
    assert client.get("/specs").status_code == 501
    assert client.get("/inspections").status_code == 501
