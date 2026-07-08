import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    name: str | None
    points: int
    birthday: date | None
    created_at: datetime
