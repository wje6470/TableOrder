from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class RevenuePoint(BaseModel):
    period: str  # e.g. "2026-07-08" for daily, "2026-07" for monthly
    revenue: Decimal
    order_count: int


class ProductRanking(BaseModel):
    product_id: str
    product_name: str
    quantity_sold: int
    revenue: Decimal


class AvgOrderValue(BaseModel):
    start_date: date
    end_date: date
    order_count: int
    total_revenue: Decimal
    avg_order_value: Decimal
