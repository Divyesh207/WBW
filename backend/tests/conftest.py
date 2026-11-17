import copy
import os
import sys
from pathlib import Path

# Use an isolated in-memory database for tests (must be set before app import).
os.environ["WBW_DATABASE_URL"] = "sqlite:///:memory:"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from app.schemas.product import ProductSpec  # noqa: E402
from app.services.demo_data import DEMO_SCENARIOS  # noqa: E402


@pytest.fixture
def bottle_dict() -> dict:
    return copy.deepcopy(DEMO_SCENARIOS[0]["spec"])


@pytest.fixture
def bottle(bottle_dict) -> ProductSpec:
    return ProductSpec.model_validate(bottle_dict)
