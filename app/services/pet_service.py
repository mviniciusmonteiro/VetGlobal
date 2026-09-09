from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.pet import Pet
from app.schemas.pet import PetCreate


def create_pet(db: Session, pet_in: PetCreate) -> Pet:
    """
    Cria e persiste um novo Pet no banco de dados.
    """
    pet = Pet(
        name=pet_in.name,
        owner_name=pet_in.owner_name,
    )
    db.add(pet)
    db.commit()
    db.refresh(pet)
    return pet


def get_pet_by_id(db: Session, pet_id: int) -> Optional[Pet]:
    """
    Recupera um Pet pelo seu ID primário.
    Retorna None se o registro não for encontrado.
    """
    return db.get(Pet, pet_id)


def list_pets(db: Session, skip: int = 0, limit: int = 100) -> List[Pet]:
    """
    Lista pets com paginação básica.
    """
    stmt = select(Pet).offset(skip).limit(limit).order_by(Pet.id)
    return list(db.scalars(stmt).all())
