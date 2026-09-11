import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(api_router)

@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Health check endpoint to verify system status."""
    return {"status": "ok"}


# Serve built React frontend if available
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


