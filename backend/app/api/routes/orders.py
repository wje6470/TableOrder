import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_customer, get_current_payload, get_current_store
from app.db.session import get_db
from app.models.customer import Customer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.store_account import StoreAccount
from app.models.table import Table
from app.schemas.order import AddItemsRequest, CheckoutRequest, OrderOpenRequest, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])


async def _get_order_with_items(db: AsyncSession, order_id: uuid.UUID) -> Order:
    order = await db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items))
        .execution_options(populate_existing=True)
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="訂單不存在")
    return order


@router.post("/open", response_model=OrderOut)
async def open_order(
    payload: OrderOpenRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    table = await db.scalar(select(Table).where(Table.table_number == payload.table_number))
    if table is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="桌號不存在")

    existing = await db.scalar(
        select(Order)
        .where(Order.table_id == table.id, Order.status == "open")
        .options(selectinload(Order.items))
    )
    if existing is not None:
        return existing

    order = Order(table_id=table.id, customer_id=customer.id, status="open", total_amount=0)
    db.add(order)
    table.status = "occupied"
    await db.commit()
    return await _get_order_with_items(db, order.id)


@router.post("/{order_id}/items", response_model=OrderOut)
async def add_items(
    order_id: uuid.UUID,
    payload: AddItemsRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    order = await _get_order_with_items(db, order_id)
    if order.customer_id != customer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="這不是你正在使用的訂單")
    if order.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此訂單已結帳，無法加點")
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="請至少選擇一項商品")

    added_total = 0
    for item in payload.items:
        product = await db.get(Product, item.product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
        if not product.is_available:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"「{product.name}」已售完")
        subtotal = product.price * item.quantity
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=product.price,
                subtotal=subtotal,
            )
        )
        added_total += subtotal

    order.total_amount = order.total_amount + added_total
    await db.commit()
    return await _get_order_with_items(db, order_id)


@router.get("/open", response_model=list[OrderOut])
async def list_open_orders(
    _: StoreAccount = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    result = await db.scalars(
        select(Order).where(Order.status == "open").options(selectinload(Order.items)).order_by(Order.opened_at)
    )
    return result.all()


@router.get("/history/me", response_model=list[OrderOut])
async def my_order_history(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.scalars(
        select(Order)
        .where(Order.customer_id == customer.id, Order.status == "closed")
        .options(selectinload(Order.items))
        .order_by(Order.closed_at.desc())
    )
    return result.all()


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: uuid.UUID,
    payload: dict = Depends(get_current_payload),
    db: AsyncSession = Depends(get_db),
):
    order = await _get_order_with_items(db, order_id)
    if payload.get("role") == "customer" and str(order.customer_id) != payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="這不是你的訂單")
    return order


@router.post("/{order_id}/checkout", response_model=OrderOut)
async def checkout_order(
    order_id: uuid.UUID,
    payload: CheckoutRequest,
    _: StoreAccount = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    if payload.payment_method not in ("cash", "other"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="付款方式僅支援 cash 或 other")

    order = await _get_order_with_items(db, order_id)
    if order.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此訂單已結帳")

    table = await db.get(Table, order.table_id)

    order.total_amount = sum((item.subtotal for item in order.items), Decimal("0"))
    order.payment_method = payload.payment_method
    order.paid_amount = order.total_amount
    order.status = "closed"
    order.closed_at = datetime.now(timezone.utc)
    if table is not None:
        table.status = "idle"

    await db.commit()
    return await _get_order_with_items(db, order_id)
