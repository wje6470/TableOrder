from typing import Literal

from pydantic import BaseModel

from app.schemas.product import ProductOut


class RecommendedProductOut(BaseModel):
    product: ProductOut
    reason: str | None
    source: Literal["ai", "popular"]
