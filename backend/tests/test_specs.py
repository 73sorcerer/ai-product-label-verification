"""POST /specs, GET /specs, GET /specs/{id}.  OWNER: Amzad"""
from datetime import datetime

import pytest

GRANOLA = {
    "name": "Golden Harvest Granola",
    "fields": {
        "brand": "Sunrise Farms",
        "net_contents": "Net Wt 12 oz (340 g)",
        "allergens": "Contains: Oats, Almonds, Milk",
    },
}


def create(client, spec=GRANOLA):
    r = client.post("/specs", json=spec)
    assert r.status_code == 201, r.text
    return r.json()


# --- POST /specs -------------------------------------------------------------


def test_create_spec_returns_201_with_id_and_utc_timestamp(client):
    spec = create(client)
    assert spec["id"] >= 1
    assert spec["name"] == GRANOLA["name"]
    assert spec["fields"] == GRANOLA["fields"]
    created = datetime.fromisoformat(spec["created_at"])
    assert created.utcoffset().total_seconds() == 0


def test_create_spec_keeps_field_order(client):
    fields = {"z_last": "a", "a_first": "b", "m_middle": "c"}
    assert list(create(client, {"name": "Order", "fields": fields})["fields"]) == list(fields)


def test_create_spec_strips_surrounding_whitespace(client):
    spec = create(client, {"name": "  Granola  ", "fields": {" brand ": "  Sunrise Farms "}})
    assert spec["name"] == "Granola"
    assert spec["fields"] == {"brand": "Sunrise Farms"}


def test_create_spec_assigns_increasing_ids(client):
    assert create(client)["id"] < create(client)["id"]


@pytest.mark.parametrize(
    "body",
    [
        {"fields": {"brand": "X"}},  # no name
        {"name": "X"},  # no fields
        {"name": "   ", "fields": {"brand": "X"}},  # blank name
        {"name": "X" * 201, "fields": {"brand": "X"}},  # name too long for the column
        {"name": "X", "fields": {}},  # nothing to check
        {"name": "X", "fields": {"brand": ""}},  # blank expected value
        {"name": "X", "fields": {"  ": "X"}},  # blank field key
        {"name": "X", "fields": {"net_contents": 12}},  # values must be text
        {"name": "X", "fields": ["brand"]},  # fields must be an object
    ],
    ids=["no-name", "no-fields", "blank-name", "long-name", "empty-fields",
         "blank-value", "blank-key", "non-string-value", "fields-not-object"],
)
def test_create_spec_rejects_invalid_body(client, body):
    assert client.post("/specs", json=body).status_code == 422
    assert client.get("/specs").json() == []  # nothing saved


# --- GET /specs ----------------------------------------------------------------


def test_list_specs_empty(client):
    r = client.get("/specs")
    assert r.status_code == 200
    assert r.json() == []


def test_list_specs_returns_all_in_creation_order(client):
    first = create(client)
    second = create(client, {"name": "Peak Cold Brew", "fields": {"brand": "Peak Roasters"}})
    assert client.get("/specs").json() == [first, second]


# --- GET /specs/{id} -------------------------------------------------------------


def test_get_spec_by_id(client):
    spec = create(client)
    r = client.get(f"/specs/{spec['id']}")
    assert r.status_code == 200
    assert r.json() == spec


@pytest.mark.parametrize("spec_id", [999, 0, -1, 2**31, 999_999_999_999])
def test_get_unknown_spec_is_404(client, spec_id):
    create(client)
    r = client.get(f"/specs/{spec_id}")
    assert r.status_code == 404
    assert "not found" in r.json()["detail"]


def test_get_spec_with_non_integer_id_is_422(client):
    assert client.get("/specs/granola").status_code == 422


def test_specs_persist_across_app_restarts(client):
    from fastapi.testclient import TestClient

    from app.main import app

    spec = create(client)
    with TestClient(app) as restarted:  # init_db() runs again; existing rows must survive
        assert restarted.get(f"/specs/{spec['id']}").json() == spec


# --- DELETE /specs/{id} -------------------------------------------------------


def test_delete_unused_spec_returns_204_and_removes_it(client):
    spec = create(client)
    assert client.delete(f"/specs/{spec['id']}").status_code == 204
    assert client.get(f"/specs/{spec['id']}").status_code == 404
    assert client.get("/specs").json() == []


def test_delete_unknown_spec_is_404(client):
    assert client.delete("/specs/999999").status_code == 404


def test_delete_spec_with_inspections_is_refused(client, fake_ocr):
    """Inspections point at their spec; deleting it would orphan the history."""
    spec = create(client)
    fake_ocr([("Sunrise Farms", 0.99)])
    files = {"image": ("label.png", b"fake", "image/png")}
    assert client.post("/inspections", data={"spec_id": spec["id"]}, files=files).status_code == 201
    r = client.delete(f"/specs/{spec['id']}")
    assert r.status_code == 409
    assert "inspection" in r.json()["detail"].lower()
    assert client.get(f"/specs/{spec['id']}").status_code == 200
