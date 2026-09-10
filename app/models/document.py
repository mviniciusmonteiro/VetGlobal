from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.pet import Pet
    from app.models.job import Job


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pet_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False,
        index=True,
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    pet: Mapped["Pet"] = relationship("Pet", back_populates="documents")
    jobs: Mapped[List["Job"]] = relationship(
        "Job",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="Job.id",
    )

    @property
    def completed_at(self) -> Optional[datetime]:
        """
        Retorna o timestamp de conclusão (completed_at) do job mais recente
        associado a este documento, para fins de observabilidade.
        """
        if self.jobs:
            return self.jobs[-1].completed_at
        return None

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, pet_id={self.pet_id}, filename='{self.filename}', status='{self.status}')>"

