"""Stored assessment: the specification plus everything calculated from it."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    spec: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    recommendations: Mapped[list] = mapped_column(JSON)
    selected_ids: Mapped[list] = mapped_column(JSON)
    optimized_spec: Mapped[dict] = mapped_column(JSON)
    optimized_result: Mapped[dict] = mapped_column(JSON)
    comparison: Mapped[dict] = mapped_column(JSON)

    @property
    def created_iso(self) -> str:
        return self.created_at.replace(tzinfo=timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "created_at": self.created_iso,
            "is_demo": self.is_demo,
            "spec": self.spec,
            "result": self.result,
            "recommendations": self.recommendations,
            "selected_ids": self.selected_ids,
            "optimized_spec": self.optimized_spec,
            "optimized_result": self.optimized_result,
            "comparison": self.comparison,
        }

    def summary(self) -> dict:
        hotspots = self.result.get("hotspots") or []
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "created_at": self.created_iso,
            "is_demo": self.is_demo,
            "production_quantity": self.spec["production_quantity"],
            "carbon_per_unit_kg": self.result["per_unit"]["carbon_kg"],
            "carbon_batch_kg": self.result["batch"]["carbon_kg"],
            "optimized_carbon_batch_kg": self.optimized_result["batch"]["carbon_kg"],
            "carbon_change_pct": self.comparison["summary"]["carbon_change_pct"],
            "applied_count": len(self.selected_ids),
            "recommendation_count": len(self.recommendations),
            "data_quality": self.result["data_quality"]["rating"],
            "uncertainty_pct": self.result["data_quality"]["uncertainty_pct"],
            "top_hotspot": hotspots[0]["area"] if hotspots else None,
        }
