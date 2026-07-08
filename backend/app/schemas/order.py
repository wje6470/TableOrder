import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class OrderOpenRequest(BaseModel):
    table_number: str


class OrderItemIn(BaseModel):
    product_id: uuid.UUID
    quantity: int


class AddItemsRequest(BaseModel):
    items: list[OrderItemIn]


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    created_at: datetime


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    table_id: uuid.UUID
    customer_id: uuid.UUID
    status: str
    opened_at: datetime
    closed_at: datetime | None
    payment_method: str | None
    paid_amount: Decimal | None
    total_amount: Decimal
    items: list[OrderItemOut] = []


class CheckoutRequest(BaseModel):
    payment_method: str  # "cash" | "other"
