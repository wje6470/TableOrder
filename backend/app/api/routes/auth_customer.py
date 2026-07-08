from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.customer import Customer
from app.schemas.auth import CustomerLogin, CustomerRegister, Token

router = APIRouter(prefix="/auth/customer", tags=["customer-auth"])


@router.post("/register", response_model=Token)
async def register(payload: CustomerRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(Customer).where(Customer.phone == payload.phone))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="此手機號碼已註冊過")

    customer = Customer(phone=payload.phone, password_hash=hash_password(payload.password), name=payload.name)
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    token = create_access_token(subject=str(customer.id), role="customer")
    return Token(access_token=token)


@router.post("/login", response_model=Token)
async def login(payload: CustomerLogin, db: AsyncSession = Depends(get_db)):
    customer = await db.scalar(select(Customer).where(Customer.phone == payload.phone))
    if customer is None or not verify_password(payload.password, customer.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="手機號碼或密碼錯誤")

    token = create_access_token(subject=str(customer.id), role="customer")
    return Token(access_token=token)
