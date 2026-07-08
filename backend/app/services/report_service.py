from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.schemas.report import AvgOrderValue, ProductRanking, RevenuePoint


def _range_bounds(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
    return start, end


async def get_revenue(db: AsyncSession, start_date: date, end_date: date, period: str) -> list[RevenuePoint]:
    start, end = _range_bounds(start_date, end_date)
    bucket_format = "YYYY-MM-DD" if period == "daily" else "YYYY-MM"
    bucket = func.to_char(Order.closed_at, bucket_format).label("bucket")

    query = (
        select(bucket, func.sum(Order.total_amount), func.count(Order.id))
        .where(Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end)
        .group_by(bucket)
        .order_by(bucket)
    )
    rows = (await db.execute(query)).all()
    return [
        RevenuePoint(period=row[0], revenue=row[1] or Decimal("0"), order_count=row[2])
        for row in rows
    ]


async def get_top_products(
    db: AsyncSession, start_date: date, end_date: date, limit: int = 10
) -> list[ProductRanking]:
    start, end = _range_bounds(start_date, end_date)
    query = (
        select(
            Product.id,
            Product.name,
            func.sum(OrderItem.quantity),
            func.sum(OrderItem.subtotal),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [
        ProductRanking(product_id=str(row[0]), product_name=row[1], quantity_sold=row[2], revenue=row[3])
        for row in rows
    ]


async def get_avg_order_value(db: AsyncSession, start_date: date, end_date: date) -> AvgOrderValue:
    start, end = _range_bounds(start_date, end_date)
    query = select(func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0)).where(
        Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end
    )
    order_count, total_revenue = (await db.execute(query)).one()
    avg = (total_revenue / order_count) if order_count else Decimal("0")
    return AvgOrderValue(
        start_date=start_date,
        end_date=end_date,
        order_count=order_count,
        total_revenue=total_revenue,
        avg_order_value=avg,
    )


async def get_order_detail_rows(db: AsyncSession, start_date: date, end_date: date) -> list[dict]:
    """匯出報表用的逐筆訂單品項明細。"""
    start, end = _range_bounds(start_date, end_date)
    query = (
        select(
            Order.id,
            Order.closed_at,
            Product.name,
            OrderItem.quantity,
            OrderItem.unit_price,
            OrderItem.subtotal,
            Order.payment_method,
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end)
        .order_by(Order.closed_at)
    )
    rows = (await db.execute(query)).all()
    return [
        {
            "order_id": str(row[0]),
            "closed_at": row[1].isoformat() if row[1] else "",
            "product_name": row[2],
            "quantity": row[3],
            "unit_price": row[4],
            "subtotal": row[5],
            "payment_method": row[6],
        }
        for row in rows
    ]
