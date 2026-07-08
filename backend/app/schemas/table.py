import uuid

from pydantic import BaseModel, ConfigDict


class TableCreate(BaseModel):
    table_number: str


class TableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    table_number: str
    status: str
