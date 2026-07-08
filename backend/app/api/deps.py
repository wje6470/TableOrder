import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.customer import Customer
from app.models.store_account import StoreAccount

bearer_scheme = HTTPBearer()


async def _decode_or_401(credentials: HTTPAuthorizationCredentials) -> dict:
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="無效或過期的登入憑證")
    return payload


async def get_current_payload(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """給需要同時接受顧客或店家身分的端點使用（例如查詢單一訂單）。"""
    return await _decode_or_401(credentials)


async def get_current_customer(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    payload = await _decode_or_401(credentials)
    if payload.get("role") != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="此操作需要顧客身分")
    customer = await db.get(Customer, uuid.UUID(payload["sub"]))
    if customer is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="帳號不存在")
    return customer


async def get_current_store(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> StoreAccount:
    payload = await _decode_or_401(credentials)
    if payload.get("role") != "store":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="此操作需要店家身分")
    account = await db.get(StoreAccount, uuid.UUID(payload["sub"]))
    if account is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="帳號不存在")
    return account
