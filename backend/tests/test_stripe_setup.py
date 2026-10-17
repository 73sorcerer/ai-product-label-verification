"""backend/scripts/stripe_setup.py: catalog/webhook setup must be idempotent.  OWNER: Tray"""
import importlib.util
from pathlib import Path
from types import SimpleNamespace as NS

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "stripe_setup.py"
spec = importlib.util.spec_from_file_location("stripe_setup", SCRIPT)
stripe_setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stripe_setup)


class FakeCatalog:
    """In-memory Stripe: products, prices (by lookup_key), webhook endpoints."""

    def __init__(self):
        self.products, self.prices, self.endpoints, self.creates = [], [], [], 0
        cat = self

        class Products:
            def create(self, params):
                cat.creates += 1
                p = NS(id=f"prod_{len(cat.products)}", **params); cat.products.append(p); return p

        class Prices:
            def list(self, params):
                keys = set(params.get("lookup_keys", []))
                return NS(data=[p for p in cat.prices if p.lookup_key in keys])

            def create(self, params):
                cat.creates += 1
                p = NS(id=f"price_{len(cat.prices)}", **params); cat.prices.append(p); return p

        class Endpoints:
            def list(self, params):
                return NS(data=cat.endpoints)

            def create(self, params):
                cat.creates += 1
                e = NS(id="we_1", secret="whsec_SECRET", **params); cat.endpoints.append(e); return e

            def update(self, endpoint_id, params):
                return None

        self.v1 = NS(products=Products(), prices=Prices(), webhook_endpoints=Endpoints())


def test_catalog_creates_three_products_and_six_prices_once():
    fake, log = FakeCatalog(), []
    ids = stripe_setup.ensure_catalog(fake, log=log.append)
    assert len(fake.products) == 3 and len(fake.prices) == 6
    assert set(ids) == {f"{p}_{i}" for p in ("starter", "professional", "enterprise") for i in ("monthly", "annual")}
    pro_annual = next(p for p in fake.prices if p.lookup_key == "professional_annual")
    assert (pro_annual.unit_amount, pro_annual.recurring) == (149000, {"interval": "year"})
    before = fake.creates
    assert stripe_setup.ensure_catalog(fake, log=log.append) == ids  # second run
    assert fake.creates == before  # nothing new created


def test_webhook_created_once_and_secret_never_logged():
    fake, log, written = FakeCatalog(), [], []
    stripe_setup.ensure_webhook(fake, written.append, log=log.append)
    stripe_setup.ensure_webhook(fake, written.append, log=log.append)
    assert len(fake.endpoints) == 1
    assert fake.endpoints[0].enabled_events == stripe_setup.WEBHOOK_EVENTS
    assert written == ["whsec_SECRET"]
    assert not any("whsec_" in line for line in log)
