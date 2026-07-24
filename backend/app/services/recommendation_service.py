import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.customer_recommendation import CustomerRecommendation
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.schemas.product import ProductOut
from app.schemas.recommendation import RecommendedProductOut
from app.services.gemini_client import generate_json, parse_product_picks

MAX_RECOMMENDATIONS = 3


async def _get_order_history_summary(db: AsyncSession, customer_id: uuid.UUID) -> list[tuple[str, int]]:
    """這位顧客過去已結帳訂單裡，每個商品點過幾次（次數由高到低）。"""
    query = (
        select(OrderItem.product_name, func.sum(OrderItem.quantity))
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.customer_id == customer_id, Order.status == "closed")
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
    )
    rows = (await db.execute(query)).all()
    return [(name, int(count)) for name, count in rows]


async def _get_latest_closed_order_at(db: AsyncSession, customer_id: uuid.UUID) -> datetime | None:
    return await db.scalar(
        select(func.max(Order.closed_at)).where(Order.customer_id == customer_id, Order.status == "closed")
    )


async def get_popular_products(db: AsyncSession, limit: int = MAX_RECOMMENDATIONS) -> list[Product]:
    """全店賣最好的上架中商品（依已結帳訂單的點餐數量排序）。"""
    quantity_sum = func.sum(OrderItem.quantity)
    query = (
        select(Product)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status == "closed", Product.is_available.is_(True))
        .group_by(Product.id)
        .order_by(quantity_sum.desc())
        .limit(limit)
    )
    return list((await db.scalars(query)).all())


def to_popular_out(products: list[Product]) -> list[RecommendedProductOut]:
    return [
        RecommendedProductOut(product=ProductOut.model_validate(p), reason=None, source="popular")
        for p in products
    ]


async def get_fallback_products(db: AsyncSession, limit: int = MAX_RECOMMENDATIONS) -> list[Product]:
    """AI 沒有適合的推薦結果時的候補清單：優先用全店賣最好的上架商品；
    如果店裡還沒有任何已結帳銷售紀錄（賣最好的清單是空的），改用目前上架中單價最高的商品，
    確保只要菜單上還有商品，就一定推得出東西。
    """
    popular = await get_popular_products(db, limit)
    if popular:
        return popular
    query = (
        select(Product).where(Product.is_available.is_(True)).order_by(Product.price.desc()).limit(limit)
    )
    return list((await db.scalars(query)).all())


async def get_recommendations_for_customer(db: AsyncSession, customer: Customer) -> list[RecommendedProductOut]:
    history = await _get_order_history_summary(db, customer.id)
    if not history:
        return to_popular_out(await get_fallback_products(db))

    latest_order_at = await _get_latest_closed_order_at(db, customer.id)
    cache = await db.get(CustomerRecommendation, customer.id)
    needs_refresh = cache is None or (latest_order_at is not None and latest_order_at > cache.generated_at)

    if not needs_refresh:
        products = list(
            (
                await db.scalars(
                    select(Product).where(Product.id.in_(cache.product_ids), Product.is_available.is_(True))
                )
            ).all()
        )
        if products:
            by_id = {p.id: p for p in products}
            ordered = [by_id[pid] for pid in cache.product_ids if pid in by_id]
            reason_by_id = dict(zip(cache.product_ids, cache.reasons))
            return [
                RecommendedProductOut(
                    product=ProductOut.model_validate(p), reason=reason_by_id.get(p.id) or None, source="ai"
                )
                for p in ordered
            ]
        # 快取裡的商品全部已下架或被刪除了，視為需要重新產生。

    menu = list((await db.scalars(select(Product).where(Product.is_available.is_(True)))).all())
    menu_by_id = {p.id: p for p in menu}

    history_lines = "\n".join(f"- {name} x{count}" for name, count in history)
    menu_lines = "\n".join(f"- id={p.id} 名稱={p.name} 價格={p.price}" for p in menu)
    prompt = (
        "你是餐廳的點餐推薦助手。這位顧客過去點過的餐點如下（次數由高到低）：\n"
        f"{history_lines}\n\n"
        "目前上架中的完整菜單如下：\n"
        f"{menu_lines}\n\n"
        "請根據這位顧客的點餐習慣，從上面「目前上架中的完整菜單」裡挑選最多 3 樣他可能會喜歡的商品。\n"
        "只能挑選菜單裡列出的 id，不可以自己編造不存在的商品。\n"
        '用 JSON 陣列格式回覆，每個元素是 {"product_id": "<菜單裡的 id>", "reason": "一句話中文推薦理由"}，'
        "不要有其他文字。"
    )
    picks = parse_product_picks(await generate_json(prompt), menu_by_id, MAX_RECOMMENDATIONS)

    if not picks:
        return to_popular_out(await get_fallback_products(db))

    product_ids = [pid for pid, _ in picks]
    reasons = [reason or "" for _, reason in picks]

    if cache is None:
        cache = CustomerRecommendation(customer_id=customer.id, product_ids=product_ids, reasons=reasons)
        db.add(cache)
    else:
        cache.product_ids = product_ids
        cache.reasons = reasons
        cache.generated_at = datetime.now(timezone.utc)
    await db.commit()

    return [
        RecommendedProductOut(product=ProductOut.model_validate(menu_by_id[pid]), reason=reason or None, source="ai")
        for pid, reason in picks
    ]
