import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class OrderOpenRequest(BaseModel):
    table_number: str


class OrderItemIn(BaseModel):
    product_id: uuid.UUID
    quantity: int
    note: str | None = Field(default=None, max_length=200)
    selected_option_ids: list[uuid.UUID] = []


class AddItemsRequest(BaseModel):
    items: list[OrderItemIn]


class OrderItemOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    group_name: str
    option_name: str
    price_delta: Decimal


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    note: str | None
    options: list[OrderItemOptionOut] = []
    is_completed: bool
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
    discount_amount: Decimal
    items: list[OrderItemOut] = []


class CheckoutRequest(BaseModel):
    payment_method: str  # 目前僅支援 "cash"，線上金流走 /orders/{order_id}/payments/{provider}/request
