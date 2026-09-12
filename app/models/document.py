from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import DateTime, ForeignKey, Index, Integer, LargeBinary, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.pet import Pet
    from app.models.job import Job


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_pet_hash", "pet_id", "file_hash"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pet_id: Mapped[int] = mapped_column(
        ForeignKey("pets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
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

    @property
    def duration_ms(self) -> Optional[int]:
        """
        Retorna a duração total do processamento em milissegundos
        (completed_at - created_at) do job mais recente associado.
        """
        if self.jobs and self.jobs[-1].completed_at and self.jobs[-1].created_at:
            delta = self.jobs[-1].completed_at - self.jobs[-1].created_at
            return max(0, int(delta.total_seconds() * 1000))
        return None

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, pet_id={self.pet_id}, filename='{self.filename}', status='{self.status}')>"


