from datetime import date

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CustomerRegister(BaseModel):
    phone: str
    password: str
    name: str | None = None
    birthday: date | None = None


class CustomerLogin(BaseModel):
    phone: str
    password: str


class StoreLogin(BaseModel):
    username: str
    password: str
