from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer
from app.db.session import get_db
from app.models.customer import Customer
from app.schemas.recommendation import RecommendedProductOut
from app.services import recommendation_service

router = APIRouter(prefix="/customers/me", tags=["recommendations"])


@router.get("/recommendations", response_model=list[RecommendedProductOut])
async def get_my_recommendations(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    return await recommendation_service.get_recommendations_for_customer(db, customer)
