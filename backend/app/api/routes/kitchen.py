import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_store
from app.db.session import get_db
from app.models.kitchen_ticket import KitchenTicket
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.kitchen import KitchenItemStatusUpdate, KitchenTicketOut
from app.schemas.order import OrderItemOut

router = APIRouter(prefix="/kitchen", tags=["kitchen"])


@router.get("/tickets", response_model=list[KitchenTicketOut], dependencies=[Depends(get_current_store)])
async def list_kitchen_tickets(db: AsyncSession = Depends(get_db)):
    result = await db.scalars(
        select(KitchenTicket)
        .join(Order, KitchenTicket.order_id == Order.id)
        .where(Order.status == "open")
        .order_by(KitchenTicket.created_at)
    )
    return result.all()


@router.patch(
    "/tickets/{ticket_id}/items/{item_id}",
    response_model=OrderItemOut,
    dependencies=[Depends(get_current_store)],
)
async def set_item_completed(
    ticket_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: KitchenItemStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(OrderItem, item_id)
    if item is None or item.ticket_id != ticket_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="品項不存在")
    item.is_completed = payload.is_completed
    await db.commit()
    await db.refresh(item)
    return item
