import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ProductOptionIn(BaseModel):
    name: str
    price_delta: Decimal = Decimal("0")


class ProductOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    price_delta: Decimal


class ProductOptionGroupIn(BaseModel):
    name: str
    selection_type: Literal["single", "multi"]
    is_required: bool = False
    options: list[ProductOptionIn] = []


class ProductOptionGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    selection_type: str
    is_required: bool
    options: list[ProductOptionOut] = []
