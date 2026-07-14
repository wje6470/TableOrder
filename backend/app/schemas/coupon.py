import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class CouponBulkCreate(BaseModel):
    title: str | None = None
    discount_type: Literal["fixed", "percentage"]
    discount_value: Decimal
    product_id: uuid.UUID | None = None


class CouponApplyRequest(BaseModel):
    order_id: uuid.UUID


class CouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    order_id: uuid.UUID | None
    product_id: uuid.UUID | None
    title: str | None
    discount_type: str
    discount_value: Decimal
    valid_until: date | None
    source: str
    is_used: bool
    used_at: datetime | None
    created_at: datetime


class BirthdayCouponRuleIn(BaseModel):
    product_id: uuid.UUID
    discount_type: Literal["fixed", "percentage"]
    discount_value: Decimal
    title: str | None = None
    is_enabled: bool = True


class BirthdayCouponRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    discount_type: str
    discount_value: Decimal
    title: str | None
    is_enabled: bool
    created_at: datetime
    updated_at: datetime
