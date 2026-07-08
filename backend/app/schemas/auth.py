from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CustomerRegister(BaseModel):
    phone: str
    password: str
    name: str | None = None


class CustomerLogin(BaseModel):
    phone: str
    password: str


class StoreLogin(BaseModel):
    username: str
    password: str
