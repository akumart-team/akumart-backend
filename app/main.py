"""
Main entry point for the Akumart API application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import all_routers


app = FastAPI(
    title="Akumart API",
    description="B2B Waste to Resource Marketplace",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


for _router in all_routers:
    app.include_router(_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Verify the API service status and availability."""
    return {"status": "ok", "service": "AkuMart API"}
