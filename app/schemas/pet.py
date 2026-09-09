from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PetBase(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Nome do pet",
        examples=["Hank"],
    )
    owner_name: str = Field(
        ...,
        min_length=1,
        max_length=150,
        description="Nome do tutor/dono do pet",
        examples=["John Bergeson"],
    )

    @field_validator("name", "owner_name", mode="after")
    @classmethod
    def validate_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("O campo não pode ser vazio ou conter apenas espaços em branco.")
        return cleaned


class PetCreate(PetBase):
    """Schema para criação de um novo Pet via POST /pets."""
    pass


class PetResponse(BaseModel):
    """Schema de resposta com dados do Pet cadastrado."""
    id: int
    name: str
    owner_name: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
