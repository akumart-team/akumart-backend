"""
Main entry point for the Akumart API application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


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


@app.get("/health")
async def health_check():
    """Verify the API service status and availability."""
    return {"status": "ok", "service": "AkuMart API"}
