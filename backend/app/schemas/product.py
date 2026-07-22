import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.product_option import ProductOptionGroupOut


class ProductCreate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str
    description: str | None = None
    price: Decimal = Field(ge=0)
    image_url: str | None = None
    is_available: bool = True


class ProductUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = None
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
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
