import uuid
from datetime import date, datetime, time, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.coupon import Coupon
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.schemas.report import (
    AvgOrderValue,
    CategoryRanking,
    CouponSourceStats,
    CouponStats,
    PaymentMethodBreakdown,
    ProductRanking,
    ProductRevenuePoint,
    RevenuePoint,
)


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
    db: AsyncSession, start_date: date, end_date: date, limit: int = 10, sort_by: str = "quantity"
) -> list[ProductRanking]:
    start, end = _range_bounds(start_date, end_date)
    quantity_sum = func.sum(OrderItem.quantity)
    revenue_sum = func.sum(OrderItem.subtotal)
    order_column = revenue_sum if sort_by == "revenue" else quantity_sum
    query = (
        select(Product.id, Product.name, quantity_sum, revenue_sum)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end)
        .group_by(Product.id, Product.name)
        .order_by(order_column.desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [
        ProductRanking(product_id=str(row[0]), product_name=row[1], quantity_sold=row[2], revenue=row[3])
        for row in rows
    ]


async def get_payment_method_breakdown(
    db: AsyncSession, start_date: date, end_date: date
) -> list[PaymentMethodBreakdown]:
    start, end = _range_bounds(start_date, end_date)
    query = (
        select(Order.payment_method, func.sum(Order.total_amount), func.count(Order.id))
        .where(Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end)
        .group_by(Order.payment_method)
        .order_by(func.sum(Order.total_amount).desc())
    )
    rows = (await db.execute(query)).all()
    return [
        PaymentMethodBreakdown(payment_method=row[0] or "unknown", revenue=row[1] or Decimal("0"), order_count=row[2])
        for row in rows
    ]


async def get_category_ranking(db: AsyncSession, start_date: date, end_date: date) -> list[CategoryRanking]:
    start, end = _range_bounds(start_date, end_date)
    # 用 left join 保留「沒有分類」的商品，統一歸到「未分類」一組。
    query = (
        select(
            Category.id,
            func.coalesce(Category.name, "未分類"),
            func.sum(OrderItem.quantity),
            func.sum(OrderItem.subtotal),
        )
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .outerjoin(Category, Category.id == Product.category_id)
        .where(Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end)
        .group_by(Category.id, Category.name)
        .order_by(func.sum(OrderItem.subtotal).desc())
    )
    rows = (await db.execute(query)).all()
    return [
        CategoryRanking(category_id=str(row[0]) if row[0] else None, category_name=row[1], quantity_sold=row[2], revenue=row[3])
        for row in rows
    ]


async def get_product_revenue_trend(
    db: AsyncSession, product_id: uuid.UUID, start_date: date, end_date: date, period: str
) -> list[ProductRevenuePoint]:
    start, end = _range_bounds(start_date, end_date)
    bucket_format = "YYYY-MM-DD" if period == "daily" else "YYYY-MM"
    bucket = func.to_char(Order.closed_at, bucket_format).label("bucket")

    query = (
        select(bucket, func.sum(OrderItem.quantity), func.sum(OrderItem.subtotal))
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            OrderItem.product_id == product_id,
            Order.status == "closed",
            Order.closed_at >= start,
            Order.closed_at <= end,
        )
        .group_by(bucket)
        .order_by(bucket)
    )
    rows = (await db.execute(query)).all()
    return [ProductRevenuePoint(period=row[0], quantity_sold=row[1], revenue=row[2]) for row in rows]


async def get_coupon_stats(db: AsyncSession, start_date: date, end_date: date) -> CouponStats:
    start, end = _range_bounds(start_date, end_date)

    issued_query = (
        select(Coupon.source, func.count(Coupon.id))
        .where(Coupon.created_at >= start, Coupon.created_at <= end)
        .group_by(Coupon.source)
    )
    issued_rows = dict((await db.execute(issued_query)).all())

    used_query = (
        select(Coupon.source, func.count(Coupon.id))
        .where(Coupon.is_used.is_(True), Coupon.used_at >= start, Coupon.used_at <= end)
        .group_by(Coupon.source)
    )
    used_rows = dict((await db.execute(used_query)).all())

    sources = sorted(set(issued_rows) | set(used_rows))
    by_source = [
        CouponSourceStats(source=source, issued_count=issued_rows.get(source, 0), used_count=used_rows.get(source, 0))
        for source in sources
    ]

    # 折抵總金額用「這段期間結帳訂單實際折掉的金額」算，比加總優惠券面額準確——
    # 折扣可能因為金額上限或無條件捨去，跟優惠券本身的面額有落差。
    discount_query = select(func.coalesce(func.sum(Order.discount_amount), 0)).where(
        Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end
    )
    total_discount = (await db.execute(discount_query)).scalar_one()

    return CouponStats(by_source=by_source, total_discount_amount=total_discount)


async def get_avg_order_value(db: AsyncSession, start_date: date, end_date: date) -> AvgOrderValue:
    start, end = _range_bounds(start_date, end_date)
    query = select(func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0)).where(
        Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end
    )
    order_count, total_revenue = (await db.execute(query)).one()
    avg = (total_revenue / order_count).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if order_count else Decimal("0")
    return AvgOrderValue(
        start_date=start_date,
        end_date=end_date,
        order_count=order_count,
        total_revenue=total_revenue,
        avg_order_value=avg,
    )


async def get_order_detail_rows(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    product_ids: list[uuid.UUID] | None = None,
    payment_methods: list[str] | None = None,
) -> list[dict]:
    """匯出報表用的逐筆訂單品項明細。product_ids／payment_methods 沒給（None 或空清單）就不篩選，等於全部。"""
    start, end = _range_bounds(start_date, end_date)
    query = (
        select(
            Order.id,
            Order.closed_at,
            OrderItem.product_name,
            OrderItem.quantity,
            OrderItem.unit_price,
            OrderItem.subtotal,
            Order.payment_method,
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.status == "closed", Order.closed_at >= start, Order.closed_at <= end)
        .order_by(Order.closed_at)
    )
    if product_ids:
        query = query.where(OrderItem.product_id.in_(product_ids))
    if payment_methods:
        query = query.where(Order.payment_method.in_(payment_methods))
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
