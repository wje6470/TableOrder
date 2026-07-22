import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CustomerRecommendation(Base):
    __tablename__ = "customer_recommendations"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), primary_key=True
    )
    product_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False)
    reasons: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
