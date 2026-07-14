from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth_customer,
    auth_store,
    categories,
    coupons,
    kitchen,
    orders,
    products,
    reports,
    tables,
)
from app.core.config import settings

app = FastAPI(title="點餐系統 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_customer.router)
app.include_router(auth_store.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(tables.router)
app.include_router(orders.router)
app.include_router(kitchen.router)
app.include_router(coupons.router)
app.include_router(reports.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
