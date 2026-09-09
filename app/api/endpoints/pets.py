from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.pet import PetCreate, PetResponse
from app.services import pet_service

router = APIRouter(prefix="/pets", tags=["Pets"])


@router.post(
    "",
    response_model=PetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar um novo Pet",
    description="Cria um novo pet associado a um tutor e retorna os dados com o ID gerado.",
)
def create_pet(
    pet_in: PetCreate,
    db: Session = Depends(get_db),
) -> PetResponse:
    """Endpoint para cadastrar um novo pet."""
    pet = pet_service.create_pet(db=db, pet_in=pet_in)
    return pet


@router.get(
    "/{pet_id}",
    response_model=PetResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter detalhes de um Pet",
    description="Busca um pet cadastrado pelo seu identificador único.",
)
def get_pet(
    pet_id: int,
    db: Session = Depends(get_db),
) -> PetResponse:
    """Endpoint para consultar um pet pelo seu ID."""
    pet = pet_service.get_pet_by_id(db=db, pet_id=pet_id)
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pet com id {pet_id} não encontrado.",
        )
    return pet


@router.get(
    "",
    response_model=List[PetResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar Pets cadastrados",
    description="Retorna a lista de pets com suporte a paginação simples.",
)
def list_pets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> List[PetResponse]:
    """Endpoint para listar pets com paginação."""
    pets = pet_service.list_pets(db=db, skip=skip, limit=limit)
    return pets
