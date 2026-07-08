from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models.store_account import StoreAccount
from app.schemas.auth import StoreLogin, Token

router = APIRouter(prefix="/auth/store", tags=["store-auth"])


@router.post("/login", response_model=Token)
async def login(payload: StoreLogin, db: AsyncSession = Depends(get_db)):
    account = await db.scalar(select(StoreAccount).where(StoreAccount.username == payload.username))
    if account is None or not verify_password(payload.password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="帳號或密碼錯誤")

    token = create_access_token(subject=str(account.id), role="store")
    return Token(access_token=token)
