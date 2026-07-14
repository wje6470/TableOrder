import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer, get_current_store
from app.core.config import settings
from app.db.session import get_db
from app.models.birthday_coupon_rule import BirthdayCouponRule
from app.models.coupon import Coupon
from app.models.customer import Customer
from app.models.order import Order
from app.models.product import Product
from app.schemas.coupon import (
    BirthdayCouponRuleIn,
    BirthdayCouponRuleOut,
    CouponApplyRequest,
    CouponBulkCreate,
    CouponOut,
)

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _validate_discount(discount_type: str, discount_value: Decimal) -> None:
    if discount_type == "percentage" and discount_value > Decimal("100"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="百分比折扣不可超過 100")


@router.post("/bulk", dependencies=[Depends(get_current_store)])
async def bulk_create_coupons(payload: CouponBulkCreate, db: AsyncSession = Depends(get_db)):
    _validate_discount(payload.discount_type, payload.discount_value)

    customer_ids = (await db.scalars(select(Customer.id))).all()
    today = date.today()
    for customer_id in customer_ids:
        db.add(
            Coupon(
                customer_id=customer_id,
                title=payload.title,
                discount_type=payload.discount_type,
                discount_value=payload.discount_value,
                product_id=payload.product_id,
                valid_until=today,
                source="bulk",
            )
        )
    await db.commit()
    return {"issued_count": len(customer_ids)}


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


@router.get(
    "/birthday-rule", response_model=BirthdayCouponRuleOut | None, dependencies=[Depends(get_current_store)]
)
async def get_birthday_rule(db: AsyncSession = Depends(get_db)):
    return await db.scalar(select(BirthdayCouponRule).order_by(BirthdayCouponRule.created_at.desc()))


@router.put("/birthday-rule", response_model=BirthdayCouponRuleOut, dependencies=[Depends(get_current_store)])
async def set_birthday_rule(payload: BirthdayCouponRuleIn, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    _validate_discount(payload.discount_type, payload.discount_value)

    rule = await db.scalar(select(BirthdayCouponRule).order_by(BirthdayCouponRule.created_at.desc()))
    if rule is None:
        rule = BirthdayCouponRule(**payload.model_dump())
        db.add(rule)
    else:
        for field, value in payload.model_dump().items():
            setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/birthday-cron")
async def run_birthday_cron(
    db: AsyncSession = Depends(get_db),
    authorization: str = Header(default=""),
):
    expected = f"Bearer {settings.cron_secret}"
    if not settings.cron_secret or authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未授權")

    rule = await db.scalar(
        select(BirthdayCouponRule).where(BirthdayCouponRule.is_enabled.is_(True)).order_by(
            BirthdayCouponRule.created_at.desc()
        )
    )
    if rule is None:
        return {"issued_count": 0}

    today = datetime.now(timezone.utc)
    already_issued = select(Coupon.customer_id).where(
        Coupon.source == "birthday", extract("year", Coupon.created_at) == today.year
    )
    eligible_customers = await db.scalars(
        select(Customer.id).where(
            extract("month", Customer.birthday) == today.month,
            Customer.id.notin_(already_issued),
        )
    )
    customer_ids = eligible_customers.all()
    for customer_id in customer_ids:
        db.add(
            Coupon(
                customer_id=customer_id,
                title=rule.title,
                discount_type=rule.discount_type,
                discount_value=rule.discount_value,
                product_id=rule.product_id,
                source="birthday",
            )
        )
    await db.commit()
    return {"issued_count": len(customer_ids)}
