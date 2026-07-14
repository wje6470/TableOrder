import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class OrderItemOption(Base):
    __tablename__ = "order_item_options"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False
    )
    group_name: Mapped[str] = mapped_column(String, nullable=False)
    option_name: Mapped[str] = mapped_column(String, nullable=False)
    price_delta: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order_item: Mapped["OrderItem"] = relationship(back_populates="options")
