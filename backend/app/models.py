"""ORM tables and request/response schemas.

OWNER: Amzad. Column and field names follow docs/api-contract.md.
"""
from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_serializer
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
    spec_id: Mapped[int] = mapped_column(ForeignKey("product_specs.id"), index=True)
    image_filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))  # pass | needs_review
    ocr: Mapped[dict] = mapped_column(JSON)  # OcrResult.to_dict()
    results: Mapped[list] = mapped_column(JSON)  # list of FieldResult dicts
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


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
