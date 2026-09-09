from fastapi import APIRouter
from app.api.endpoints import pets

api_router = APIRouter()

# Register endpoint sub-routers
api_router.include_router(pets.router)
