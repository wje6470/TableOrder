import time
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_store
from app.core.storage import ALLOWED_IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES, upload_product_image
from app.db.session import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


class AvailabilityUpdate(BaseModel):
    is_available: bool


@router.get("", response_model=list[ProductOut])
async def list_products(category_id: uuid.UUID | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Product)
    if category_id is not None:
        query = query.where(Product.category_id == category_id)
    result = await db.scalars(query.order_by(Product.created_at))
    return result.all()


@router.post("", response_model=ProductOut, dependencies=[Depends(get_current_store)])
async def create_product(payload: ProductCreate, db: AsyncSession = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut, dependencies=[Depends(get_current_store)])
async def update_product(product_id: uuid.UUID, payload: ProductUpdate, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch("/{product_id}/availability", response_model=ProductOut, dependencies=[Depends(get_current_store)])
async def set_availability(product_id: uuid.UUID, payload: AvailabilityUpdate, db: AsyncSession = Depends(get_db)):
    """給店家平板快速切換「上架／售完」用的按鈕。"""
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    product.is_available = payload.is_available
    await db.commit()
    await db.refresh(product)
    return product


@router.post("/{product_id}/image", response_model=ProductOut, dependencies=[Depends(get_current_store)])
async def upload_image(product_id: uuid.UUID, file: UploadFile, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")

    extension = ALLOWED_IMAGE_CONTENT_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="圖片格式僅支援 JPEG、PNG、WebP")

    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="圖片大小不可超過 5MB")

    object_path = f"{product_id}/{int(time.time() * 1000)}.{extension}"
    try:
        product.image_url = await upload_product_image(object_path, content, file.content_type)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="圖片上傳失敗，請稍後再試") from exc
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(get_current_store)])
async def delete_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    await db.delete(product)
    await db.commit()
