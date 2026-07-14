import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class KitchenTicket(Base):
    __tablename__ = "kitchen_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped["Order"] = relationship(lazy="selectin")
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="ticket", lazy="selectin", order_by="OrderItem.created_at"
    )

    @property
    def table_id(self) -> uuid.UUID:
        return self.order.table_id
