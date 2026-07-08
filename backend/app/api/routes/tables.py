import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_store
from app.db.session import get_db
from app.models.table import Table
from app.schemas.table import TableCreate, TableOut

router = APIRouter(prefix="/tables", tags=["tables"])


@router.get("", response_model=list[TableOut])
async def list_tables(db: AsyncSession = Depends(get_db)):
    result = await db.scalars(select(Table).order_by(Table.table_number))
    return result.all()


@router.post("", response_model=TableOut, dependencies=[Depends(get_current_store)])
async def create_table(payload: TableCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(Table).where(Table.table_number == payload.table_number))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此桌號已存在")
    table = Table(table_number=payload.table_number)
    db.add(table)
    await db.commit()
    await db.refresh(table)
    return table


@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_store)])
async def delete_table(table_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    table = await db.get(Table, table_id)
    if table is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="桌台不存在")
    await db.delete(table)
    await db.commit()
