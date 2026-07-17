import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_store
from app.api.routes.orders import _get_order_with_items, compute_checkout_totals, finalize_checkout
from app.core.config import settings
from app.db.session import get_db
from app.models.coupon import Coupon
from app.models.payment_transaction import PaymentTransaction
from app.models.store_account import StoreAccount
from app.models.table import Table
from app.schemas.order import OrderOut
from app.schemas.payment import LinePayRequestResponse, LinePayScanRequest, PaymentStatusOut
from app.services import linepay_service
from app.services.linepay_service import LinePayError

router = APIRouter(prefix="/orders/{order_id}/payments", tags=["payments"])


def _to_linepay_amount(amount: Decimal) -> int:
    """LINE Pay 的 TWD 金額不接受小數，四捨五入成整數。"""
    return int(amount.to_integral_value(rounding=ROUND_HALF_UP))


@router.post("/linepay/request", response_model=LinePayRequestResponse)
async def request_linepay_payment(
    order_id: uuid.UUID,
    _: StoreAccount = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    order = await _get_order_with_items(db, order_id)
    if order.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此訂單已結帳")

    total_amount, discount, coupon = await compute_checkout_totals(db, order)
    payable = total_amount - discount
    if payable <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="應付金額需大於 0 才能使用 LINE Pay")

    table = await db.get(Table, order.table_id)
    table_number = table.table_number if table else "?"

    # 存的是結帳當下的小計／折扣（未四捨五入），跟 LINE Pay 溝通用的整數金額用這兩個欄位算，
    # 這樣 confirm 階段才能還原出跟 request 當下完全一致的 order.total_amount，不會因為
    # LINE Pay 金額取整數而讓最後寫回 order 的小計出現誤差。
    transaction = PaymentTransaction(
        order_id=order.id,
        provider="linepay",
        provider_order_id=f"order-{order.id.hex}-{uuid.uuid4().hex[:8]}",
        amount=total_amount,
        discount_amount=discount,
        coupon_id=coupon.id if coupon else None,
        status="pending",
    )
    db.add(transaction)
    await db.flush()

    confirm_url = f"{settings.backend_base_url}/orders/{order.id}/payments/linepay/confirm"
    cancel_url = f"{settings.backend_base_url}/orders/{order.id}/payments/linepay/cancel"

    try:
        info = await linepay_service.request_payment(
            amount=_to_linepay_amount(payable),
            order_id=transaction.provider_order_id,
            product_name=f"桌號 {table_number} 結帳",
            confirm_url=confirm_url,
            cancel_url=cancel_url,
        )
    except LinePayError as exc:
        transaction.status = "failed"
        await db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LINE Pay 請款失敗：{exc.return_message}")

    transaction.provider_transaction_id = str(info["transactionId"])
    await db.commit()

    return LinePayRequestResponse(payment_url=info["paymentUrl"]["web"], transaction_id=transaction.provider_transaction_id)


@router.post("/linepay/scan", response_model=OrderOut)
async def scan_linepay_payment(
    order_id: uuid.UUID,
    payload: LinePayScanRequest,
    _: StoreAccount = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    """店員平板鏡頭掃到顧客 LINE Pay 付款碼後呼叫：直接用 Offline API 同步請款，
    成功的話這次呼叫就直接把訂單結掉，不用像線上付款那樣等 callback。
    """
    order = await _get_order_with_items(db, order_id)
    if order.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此訂單已結帳")

    total_amount, discount, coupon = await compute_checkout_totals(db, order)
    payable = total_amount - discount
    if payable <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="應付金額需大於 0 才能使用 LINE Pay")

    table = await db.get(Table, order.table_id)
    table_number = table.table_number if table else "?"

    transaction = PaymentTransaction(
        order_id=order.id,
        provider="linepay_offline",
        provider_order_id=f"order-{order.id.hex}-{uuid.uuid4().hex[:8]}",
        amount=total_amount,
        discount_amount=discount,
        coupon_id=coupon.id if coupon else None,
        status="pending",
    )
    db.add(transaction)
    await db.flush()

    try:
        await linepay_service.pay_with_one_time_key(
            amount=_to_linepay_amount(payable),
            order_id=transaction.provider_order_id,
            product_name=f"桌號 {table_number} 結帳",
            one_time_key=payload.one_time_key,
        )
    except LinePayError as exc:
        transaction.status = "failed"
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"LINE Pay 付款失敗：{exc.return_message}")

    await finalize_checkout(db, order, "linepay", transaction.amount, transaction.discount_amount, coupon)
    transaction.status = "confirmed"
    transaction.confirmed_at = datetime.now(timezone.utc)
    await db.commit()

    return await _get_order_with_items(db, order_id)


@router.get("/linepay/confirm")
async def confirm_linepay_payment(
    order_id: uuid.UUID,
    transactionId: str,
    db: AsyncSession = Depends(get_db),
):
    """LINE Pay 顧客付款完成後，瀏覽器會被導回這裡（帶 transactionId），這時才真正呼叫 Confirm API 請款並關單。"""
    result_base = f"{settings.frontend_origin}/store/payment-result"

    transaction = await db.scalar(
        select(PaymentTransaction).where(PaymentTransaction.provider_transaction_id == transactionId)
    )
    if transaction is None or transaction.order_id != order_id:
        return RedirectResponse(f"{result_base}?status=error")

    if transaction.status == "confirmed":
        return RedirectResponse(f"{result_base}?status=success")

    order = await _get_order_with_items(db, order_id)
    coupon = await db.get(Coupon, transaction.coupon_id) if transaction.coupon_id else None
    payable = transaction.amount - transaction.discount_amount

    try:
        await linepay_service.confirm_payment(
            transaction_id=transaction.provider_transaction_id, amount=_to_linepay_amount(payable)
        )
    except LinePayError:
        transaction.status = "failed"
        await db.commit()
        return RedirectResponse(f"{result_base}?status=error")

    await finalize_checkout(db, order, "linepay", transaction.amount, transaction.discount_amount, coupon)
    transaction.status = "confirmed"
    transaction.confirmed_at = datetime.now(timezone.utc)
    await db.commit()

    return RedirectResponse(f"{result_base}?status=success")


@router.get("/linepay/cancel")
async def cancel_linepay_payment(
    order_id: uuid.UUID,
    transactionId: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if transactionId:
        transaction = await db.scalar(
            select(PaymentTransaction).where(PaymentTransaction.provider_transaction_id == transactionId)
        )
        if transaction is not None and transaction.order_id == order_id and transaction.status == "pending":
            transaction.status = "cancelled"
            await db.commit()
    return RedirectResponse(f"{settings.frontend_origin}/store/payment-result?status=cancelled")


@router.get("/latest", response_model=PaymentStatusOut | None)
async def latest_payment_status(
    order_id: uuid.UUID,
    _: StoreAccount = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    """給店家平板在等待顧客完成 LINE Pay 付款時輪詢用，判斷要不要停止等待（失敗／取消）。"""
    transaction = await db.scalar(
        select(PaymentTransaction)
        .where(PaymentTransaction.order_id == order_id)
        .order_by(PaymentTransaction.created_at.desc())
    )
    if transaction is None:
        return None
    return PaymentStatusOut(provider=transaction.provider, status=transaction.status)
