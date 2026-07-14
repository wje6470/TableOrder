import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.order import OrderItemOut


class KitchenTicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    table_id: uuid.UUID
    created_at: datetime
    items: list[OrderItemOut] = []


class KitchenItemStatusUpdate(BaseModel):
    is_completed: bool
