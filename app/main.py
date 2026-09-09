from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.api.router import api_router
import app.models  # noqa: F401 - ensures models are registered on Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create database tables if they do not exist
    Base.metadata.create_all(bind=engine)
    yield
    # Clean up resources on shutdown if needed


app = FastAPI(
    title=settings.APP_NAME,
    description="VetGlobal Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# Register API routers
app.include_router(api_router)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Health check endpoint to verify system status."""
    return {"status": "ok"}

