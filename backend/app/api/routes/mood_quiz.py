from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_customer
from app.db.session import get_db
from app.models.customer import Customer
from app.schemas.mood_quiz import MoodQuizAnswerRequest, MoodQuizQuestion
from app.schemas.recommendation import RecommendedProductOut
from app.services import mood_quiz_service

router = APIRouter(prefix="/customers/me/mood-quiz", tags=["mood-quiz"])


@router.get("/questions", response_model=list[MoodQuizQuestion])
async def get_quiz_questions(_: Customer = Depends(get_current_customer)):
    return await mood_quiz_service.generate_quiz_questions()


@router.post("/recommend", response_model=list[RecommendedProductOut])
async def recommend_from_quiz(
    payload: MoodQuizAnswerRequest,
    _: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    return await mood_quiz_service.get_quiz_recommendations(db, payload.answers)
