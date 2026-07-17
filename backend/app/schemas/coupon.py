import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class CouponApplyRequest(BaseModel):
    order_id: uuid.UUID


class CouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    order_id: uuid.UUID | None
    product_id: uuid.UUID | None
    rule_id: uuid.UUID | None
    title: str | None
    discount_type: str
    discount_value: Decimal
    valid_until: date | None
    source: str
    is_used: bool
    used_at: datetime | None
    created_at: datetime


class CouponRuleIn(BaseModel):
    rule_type: Literal["birthday", "general"]
    product_id: uuid.UUID | None = None
    discount_type: Literal["fixed", "percentage"]
    discount_value: Decimal
    title: str | None = None
    is_enabled: bool = True


class CouponRuleUpdate(BaseModel):
    is_enabled: bool


class CouponRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rule_type: str
    product_id: uuid.UUID | None
    discount_type: str
    discount_value: Decimal
    title: str | None
    is_enabled: bool
    created_at: datetime
    updated_at: datetime
