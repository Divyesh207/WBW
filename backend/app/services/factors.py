"""Loads the configurable factor datasets from app/data.

Everything the engines know about materials, energy, transport, packaging and
end-of-life lives in these JSON files, so a proper LCA database can replace
them later without touching the calculation code.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


class UnknownFactorError(ValueError):
    """Raised when a specification references an id missing from the datasets."""


class FactorLibrary:
    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = Path(data_dir)
        self.raw_materials = self._load("material_factors.json")
        self.raw_energy = self._load("energy_factors.json")
        self.raw_transport = self._load("transportation_factors.json")
        self.raw_packaging = self._load("packaging_factors.json")
        self.eol = self._load("end_of_life_factors.json")

        # Every factor declares whether it is a published value or an illustrative assumption.
        for table in (
            self.raw_materials["materials"],
            self.raw_energy["energy_sources"],
            self.raw_transport["modes"],
            self.raw_packaging["options"],
        ):
            for entry in table:
                entry.setdefault("source_type", "illustrative")

        self.materials = {m["id"]: m for m in self.raw_materials["materials"]}
        self.families = self.raw_materials["families"]
        self.energy_sources = {e["id"]: e for e in self.raw_energy["energy_sources"]}
        self.methods = {m["id"]: m for m in self.raw_energy["manufacturing_methods"]}
        self.transport_modes = {t["id"]: t for t in self.raw_transport["modes"]}
        self.packaging = {p["id"]: p for p in self.raw_packaging["options"]}

    def _load(self, name: str) -> dict:
        with open(self.data_dir / name, encoding="utf-8") as fh:
            return json.load(fh)

    @staticmethod
    def _get(table: dict, key: str, kind: str) -> dict:
        try:
            return table[key]
        except KeyError:
            raise UnknownFactorError(f"Unknown {kind} '{key}'.") from None

    def material(self, key: str) -> dict:
        return self._get(self.materials, key, "material")

    def energy_source(self, key: str) -> dict:
        return self._get(self.energy_sources, key, "energy source")

    def method(self, key: str) -> dict:
        return self._get(self.methods, key, "manufacturing method")

    def transport_mode(self, key: str) -> dict:
        return self._get(self.transport_modes, key, "transport mode")

    def packaging_option(self, key: str) -> dict:
        return self._get(self.packaging, key, "packaging material")

    def eol_factor(self, family: str, method: str) -> float:
        return float(self.eol["factors"].get(family, self.eol["factors"]["none"])[method])

    def recyclable_fraction(self, level: str) -> float:
        return float(self.eol["recyclability_levels"][level]["fraction"])

    def reference(self) -> dict:
        """Everything the frontend needs to build forms and show factor provenance."""
        from app.schemas.product import CATEGORIES

        return {
            "categories": CATEGORIES,
            "families": self.families,
            "materials": self.raw_materials["materials"],
            "energy_sources": self.raw_energy["energy_sources"],
            "manufacturing_methods": self.raw_energy["manufacturing_methods"],
            "transport_modes": self.raw_transport["modes"],
            "packaging_options": self.raw_packaging["options"],
            "recyclability_levels": self.eol["recyclability_levels"],
            "disposal_methods": self.eol["disposal_methods"],
            "end_of_life_factors": self.eol["factors"],
            "use_types": {"single_use": "Single-use", "reusable": "Reusable"},
            "repairability_levels": {
                "high": "High",
                "medium": "Medium",
                "low": "Low",
                "not_applicable": "Not applicable",
            },
            "datasets": {
                "materials": self.raw_materials["meta"],
                "energy": self.raw_energy["meta"],
                "transport": self.raw_transport["meta"],
                "packaging": self.raw_packaging["meta"],
                "end_of_life": self.eol["meta"],
            },
        }


@lru_cache(maxsize=1)
def get_factors() -> FactorLibrary:
    return FactorLibrary()
