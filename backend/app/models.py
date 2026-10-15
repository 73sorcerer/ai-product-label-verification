"""ORM tables and request/response schemas.

OWNER: Amzad. STUB: column and field names follow docs/api-contract.md.
"""
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
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
    spec_id: Mapped[int] = mapped_column(ForeignKey("product_specs.id"))
    image_filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))  # pass | needs_review
    ocr: Mapped[dict] = mapped_column(JSON)  # OcrResult.to_dict()
    results: Mapped[list] = mapped_column(JSON)  # list of FieldResult dicts
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# --- API schemas ----------------------------------------------------------


class ProductSpecIn(BaseModel):
    name: str
    fields: dict[str, str]


class ProductSpecOut(ProductSpecIn):
    id: int
    created_at: datetime


class FieldResultOut(BaseModel):
    field: str
    expected: str
    found: str | None
    status: str
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


class InspectionOut(BaseModel):
    id: int
    spec_id: int
    image_filename: str
    status: str
    ocr: OcrOut
    results: list[FieldResultOut]
    created_at: datetime
