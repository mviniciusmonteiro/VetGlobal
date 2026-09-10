from fastapi import APIRouter
from app.api.endpoints import pets, documents, jobs

api_router = APIRouter()

# Register endpoint sub-routers
api_router.include_router(pets.router)
api_router.include_router(documents.router)
api_router.include_router(jobs.router)


