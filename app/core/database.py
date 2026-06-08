"""
Database configuration and session management for the AkuMart application.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Async engine — used by FastAPI at runtime
async_engine = create_async_engine(settings.DATABASE_URL, echo=True)

async_session_local = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy declarative ORM models.
    Serves as the registry for tracking tables and their metadata definitions.
    """


async def get_db():
    """
    Dependency provider that yields an asynchronous database session.
    Ensures that the session context is cleanly opened at the start of an 
    API request and automatically closed or rolled back upon completion.
    """

    async with async_session_local() as session:
        yield session
