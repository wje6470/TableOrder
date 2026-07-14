import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.schemas.product_option import ProductOptionGroupOut


class ProductCreate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str
    description: str | None = None
    price: Decimal
    image_url: str | None = None
    is_available: bool = True


class ProductUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = None
    description: str | None = None
    price: Decimal | None = None
    image_url: str | None = None
    is_available: bool | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category_id: uuid.UUID | None
    name: str
    description: str | None
    price: Decimal
    image_url: str | None
    is_available: bool
    option_groups: list[ProductOptionGroupOut] = []
