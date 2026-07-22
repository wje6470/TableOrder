import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_customer, get_current_payload, get_current_store
from app.db.session import get_db
from app.models.coupon import Coupon
from app.models.customer import Customer
from app.models.kitchen_ticket import KitchenTicket
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_item_option import OrderItemOption
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
    table_id = table.id

    existing = await db.scalar(
        select(Order)
        .where(Order.table_id == table_id, Order.status == "open")
        .options(selectinload(Order.items))
    )
    if existing is not None:
        if existing.customer_id != customer.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="此桌目前有其他顧客尚未結帳的訂單，請通知店員處理"
            )
        return existing

    order = Order(table_id=table_id, customer_id=customer.id, status="open", total_amount=0)
    db.add(order)
    table.status = "occupied"
    try:
        await db.commit()
    except IntegrityError:
        # 兩個請求幾乎同時開同一桌時會撞到 idx_orders_one_open_per_table，
        # 這時候另一個請求已經贏了，直接把它建立的那筆訂單回傳即可。
        # 用 table_id（一開始就存好的純值）查詢，而不是 table.id——
        # rollback 之後 table 這個 ORM 物件的屬性會被 expire，此時再存取
        # table.id 會觸發同步 lazy-load，在 async 環境下會丟出 MissingGreenlet。
        await db.rollback()
        existing = await db.scalar(
            select(Order)
            .where(Order.table_id == table_id, Order.status == "open")
            .options(selectinload(Order.items))
        )
        if existing is not None:
            if existing.customer_id != customer.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="此桌目前有其他顧客尚未結帳的訂單，請通知店員處理"
                )
            return existing
        raise
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

    ticket_id = uuid.uuid4()
    db.add(KitchenTicket(id=ticket_id, order_id=order.id))

    added_total = 0
    for item in payload.items:
        product = await db.get(Product, item.product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
        if not product.is_available:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"「{product.name}」已售完")

        selected_ids = set(item.selected_option_ids)
        known_option_ids = {option.id for group in product.option_groups for option in group.options}
        if not selected_ids <= known_option_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"「{product.name}」的客製化選項無效")

        price_delta_total = Decimal("0")
        item_options: list[OrderItemOption] = []
        for group in product.option_groups:
            chosen = [option for option in group.options if option.id in selected_ids]
            if group.selection_type == "single" and len(chosen) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=f"「{group.name}」只能選擇一項"
                )
            if group.is_required and len(chosen) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=f"請選擇「{product.name}」的「{group.name}」"
                )
            for option in chosen:
                price_delta_total += option.price_delta
                item_options.append(
                    OrderItemOption(group_name=group.name, option_name=option.name, price_delta=option.price_delta)
                )

        unit_price = product.price + price_delta_total
        subtotal = unit_price * item.quantity
        note = item.note.strip() if item.note else None
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name=product.name,
                quantity=item.quantity,
                unit_price=unit_price,
                subtotal=subtotal,
                note=note or None,
                options=item_options,
                ticket_id=ticket_id,
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


async def compute_checkout_totals(db: AsyncSession, order: Order) -> tuple[Decimal, Decimal, Coupon | None]:
    """計算結帳金額與可用的優惠券，但不寫入 order 本身（呼叫端決定何時真的關單）。

    若套用中的優惠券已失效（過期或限定商品未點），會直接解除跟這筆訂單的關聯——
    這一步不影響優惠券本身是否被使用過，所以不管最後付款有沒有成功都可以放心先做。
    """
    total_amount = sum((item.subtotal for item in order.items), Decimal("0"))

    coupon = await db.scalar(select(Coupon).where(Coupon.order_id == order.id, Coupon.is_used.is_(False)))
    discount = Decimal("0")
    applied_coupon: Coupon | None = None
    if coupon is not None:
        applicable_base = total_amount
        is_applicable = coupon.valid_until is None or coupon.valid_until >= date.today()

        if is_applicable and coupon.product_id is not None:
            applicable_base = sum(
                (item.subtotal for item in order.items if item.product_id == coupon.product_id), Decimal("0")
            )
            is_applicable = applicable_base > 0

        if not is_applicable:
            coupon.order_id = None
        else:
            if coupon.discount_type == "fixed":
                discount = min(coupon.discount_value, applicable_base)
            else:
                discount = min(
                    (applicable_base * coupon.discount_value / Decimal("100")).quantize(Decimal("0.01")),
                    applicable_base,
                )
            applied_coupon = coupon

    return total_amount, discount, applied_coupon


async def finalize_checkout(
    db: AsyncSession,
    order: Order,
    payment_method: str,
    total_amount: Decimal,
    discount: Decimal,
    coupon: Coupon | None,
) -> None:
    """把結帳金額寫回 order 並關單。現金結帳算完馬上呼叫；LINE Pay 等非同步金流要等 callback 確認付款成功才呼叫。"""
    table = await db.get(Table, order.table_id)

    order.total_amount = total_amount
    order.discount_amount = discount
    if coupon is not None:
        coupon.is_used = True
        coupon.used_at = datetime.now(timezone.utc)

    order.payment_method = payment_method
    order.paid_amount = total_amount - discount
    order.status = "closed"
    order.closed_at = datetime.now(timezone.utc)
    if table is not None:
        table.status = "idle"

    await db.commit()


@router.post("/{order_id}/checkout", response_model=OrderOut)
async def checkout_order(
    order_id: uuid.UUID,
    payload: CheckoutRequest,
    _: StoreAccount = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    if payload.payment_method not in ("cash", "paypal"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此端點僅支援現金或 PayPal（刷卡機獨立收款）結帳，LINE Pay 請走 /orders/{order_id}/payments/linepay/request",
        )

    order = await _get_order_with_items(db, order_id)
    if order.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此訂單已結帳")

    total_amount, discount, coupon = await compute_checkout_totals(db, order)
    await finalize_checkout(db, order, payload.payment_method, total_amount, discount, coupon)
    return await _get_order_with_items(db, order_id)
