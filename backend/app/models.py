"""ORM tables and request/response schemas.

OWNER: Amzad. Column and field names follow docs/api-contract.md.
"""
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_serializer
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- tables ---------------------------------------------------------------


class ProductSpec(Base):
    __tablename__ = "product_specs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    fields: Mapped[dict] = mapped_column(JSON)  # {"brand": "Sunrise Farms", ...}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    spec_id: Mapped[int] = mapped_column(ForeignKey("product_specs.id"), index=True)
    image_filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))  # pass | needs_review
    ocr: Mapped[dict] = mapped_column(JSON)  # OcrResult.to_dict()
    results: Mapped[list] = mapped_column(JSON)  # list of FieldResult dicts
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class Subscription(Base):
    """Stripe subscription state, written ONLY by the webhook (ADR 0003). Keyed by Stripe's ID so
    events can arrive before checkout.session.completed links the workspace."""

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[str] = mapped_column(String(255), unique=True)
    plan: Mapped[str | None] = mapped_column(String(20), nullable=True)
    billing_interval: Mapped[str | None] = mapped_column(String(10), nullable=True)  # not "interval": reserved in Postgres
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # Stripe status verbatim
    trial_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_failed: Mapped[bool] = mapped_column(Boolean, default=False)
    last_event_created: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class PendingCheckout(Base):
    """The one open Stripe Checkout Session per workspace (review finding 1): reused while open,
    expired at Stripe when replaced, deleted on checkout.session.completed / .expired."""

    __tablename__ = "pending_checkouts"

    workspace_id: Mapped[str] = mapped_column(String(64), primary_key=True)  # PK = one per workspace, race-safe
    session_id: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(2048))
    plan: Mapped[str] = mapped_column(String(20))
    billing_interval: Mapped[str] = mapped_column(String(10))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ProcessedEvent(Base):
    """Stripe event IDs already handled; makes webhook retries no-ops."""

    __tablename__ = "processed_events"

    event_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# --- API schemas ----------------------------------------------------------


NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", check_fields=False)
    def _utc_iso(self, value: datetime) -> str:
        # SQLite drops the timezone on read; every timestamp we store is UTC.
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()


class ProductSpecIn(BaseModel):
    name: Annotated[NonBlank, StringConstraints(max_length=200)]
    fields: dict[NonBlank, NonBlank] = Field(min_length=1)


class ProductSpecOut(_Out):
    id: int
    name: str
    fields: dict[str, str]
    created_at: datetime


class FieldResultOut(BaseModel):
    field: str
    expected: str
    found: str | None
    status: Literal["match", "missing", "incorrect", "uncertain"]
    confidence: float


class OcrLineOut(BaseModel):
    text: str
    confidence: float
    bbox: list[int]


class OcrOut(BaseModel):
    text: str
    lines: list[OcrLineOut]
    mean_confidence: float
    engine: str


class InspectionOut(_Out):
    id: int
    spec_id: int
    image_filename: str
    status: Literal["pass", "needs_review"]
    ocr: OcrOut
    results: list[FieldResultOut]
    created_at: datetime
