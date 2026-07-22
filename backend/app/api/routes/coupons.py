import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import extract, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer, get_current_store
from app.core.config import BUSINESS_TIMEZONE, settings
from app.db.session import get_db
from app.models.coupon import Coupon
from app.models.coupon_rule import CouponRule
from app.models.customer import Customer
from app.models.order import Order
from app.models.product import Product
from app.schemas.coupon import (
    CouponApplyRequest,
    CouponOut,
    CouponRuleIn,
    CouponRuleOut,
    CouponRuleUpdate,
)

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _validate_discount(discount_type: str, discount_value: Decimal) -> None:
    if discount_value <= Decimal("0"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="折扣值必須大於 0")
    if discount_type == "percentage" and discount_value > Decimal("100"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="百分比折扣不可超過 100")


async def _distribute_rule(db: AsyncSession, rule: CouponRule) -> int:
    """把生效中的方案發給符合資格、還沒領過這個方案的顧客，回傳這次發出的張數。

    生日方案：本月生日、今年還沒領過這個方案的顧客。
    一般方案：所有還沒領過這個方案的顧客（新註冊的顧客之後跑到也會補發）。
    """
    if rule.rule_type == "birthday":
        # 用台灣時間判斷「本月」「今年」——資料庫欄位存的是 UTC，月份／年份交界時
        # 直接用 UTC 的月份／年份比較會跟台灣的日曆差到最多 8 小時，跨月時可能誤判。
        today = datetime.now(BUSINESS_TIMEZONE)
        created_at_local = func.timezone("Asia/Taipei", Coupon.created_at)
        already_issued = select(Coupon.customer_id).where(
            Coupon.rule_id == rule.id, extract("year", created_at_local) == today.year
        )
        eligible = await db.scalars(
            select(Customer.id).where(
                extract("month", Customer.birthday) == today.month,
                Customer.id.notin_(already_issued),
            )
        )
    else:
        already_issued = select(Coupon.customer_id).where(Coupon.rule_id == rule.id)
        eligible = await db.scalars(select(Customer.id).where(Customer.id.notin_(already_issued)))

    customer_ids = eligible.all()
    for customer_id in customer_ids:
        db.add(
            Coupon(
                customer_id=customer_id,
                rule_id=rule.id,
                title=rule.title,
                discount_type=rule.discount_type,
                discount_value=rule.discount_value,
                product_id=rule.product_id,
                source=rule.rule_type,
            )
        )
    if customer_ids:
        await db.commit()
    return len(customer_ids)


@router.get("/rules", response_model=list[CouponRuleOut], dependencies=[Depends(get_current_store)])
async def list_coupon_rules(db: AsyncSession = Depends(get_db)):
    result = await db.scalars(select(CouponRule).order_by(CouponRule.created_at.desc()))
    return result.all()


@router.post("/rules", response_model=CouponRuleOut, dependencies=[Depends(get_current_store)])
async def create_coupon_rule(payload: CouponRuleIn, db: AsyncSession = Depends(get_db)):
    if payload.product_id is not None:
        product = await db.get(Product, payload.product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    _validate_discount(payload.discount_type, payload.discount_value)

    rule = CouponRule(**payload.model_dump())
    db.add(rule)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="優惠券方案資料不合法") from None
    await db.refresh(rule)

    if rule.is_enabled:
        await _distribute_rule(db, rule)
    return rule


@router.patch("/rules/{rule_id}", response_model=CouponRuleOut, dependencies=[Depends(get_current_store)])
async def update_coupon_rule(
    rule_id: uuid.UUID, payload: CouponRuleUpdate, db: AsyncSession = Depends(get_db)
):
    rule = await db.get(CouponRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="優惠券方案不存在")

    turning_on = payload.is_enabled and not rule.is_enabled
    rule.is_enabled = payload.is_enabled
    await db.commit()
    await db.refresh(rule)

    if turning_on:
        await _distribute_rule(db, rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_store)])
async def delete_coupon_rule(rule_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    rule = await db.get(CouponRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="優惠券方案不存在")
    await db.delete(rule)
    await db.commit()


@router.get("", response_model=list[CouponOut], dependencies=[Depends(get_current_store)])
async def list_coupons(db: AsyncSession = Depends(get_db)):
    result = await db.scalars(select(Coupon).order_by(Coupon.created_at.desc()))
    return result.all()


@router.get("/me", response_model=list[CouponOut])
async def list_my_coupons(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.scalars(
        select(Coupon).where(Coupon.customer_id == customer.id).order_by(Coupon.created_at.desc())
    )
    return result.all()


async def _get_own_unused_coupon(db: AsyncSession, coupon_id: uuid.UUID, customer: Customer) -> Coupon:
    coupon = await db.get(Coupon, coupon_id)
    if coupon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="優惠券不存在")
    if coupon.customer_id != customer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="這不是你的優惠券")
    if coupon.is_used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此優惠券已使用")
    return coupon


@router.post("/{coupon_id}/apply", response_model=CouponOut)
async def apply_coupon(
    coupon_id: uuid.UUID,
    payload: CouponApplyRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    coupon = await _get_own_unused_coupon(db, coupon_id, customer)

    order = await db.get(Order, payload.order_id)
    if order is None or order.customer_id != customer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="這不是你的訂單")
    if order.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此訂單已結帳，無法套用優惠券")

    other_applied = await db.scalars(
        select(Coupon).where(
            Coupon.order_id == payload.order_id, Coupon.is_used.is_(False), Coupon.id != coupon_id
        )
    )
    for other in other_applied:
        other.order_id = None

    coupon.order_id = payload.order_id
    await db.commit()
    await db.refresh(coupon)
    return coupon


@router.post("/{coupon_id}/unapply", response_model=CouponOut)
async def unapply_coupon(
    coupon_id: uuid.UUID,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    coupon = await _get_own_unused_coupon(db, coupon_id, customer)
    coupon.order_id = None
    await db.commit()
    await db.refresh(coupon)
    return coupon


@router.get("/distribute-cron")
async def run_distribute_cron(
    db: AsyncSession = Depends(get_db),
    authorization: str = Header(default=""),
):
    """給 Vercel Cron 每天呼叫一次：把所有生效中的方案發給符合資格、還沒領過的顧客。"""
    expected = f"Bearer {settings.cron_secret}"
    if not settings.cron_secret or authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未授權")

    rules = await db.scalars(select(CouponRule).where(CouponRule.is_enabled.is_(True)))
    total = 0
    for rule in rules.all():
        total += await _distribute_rule(db, rule)
    return {"issued_count": total}
