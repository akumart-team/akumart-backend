"""
Database configuration and session management for the AkuMart application.
"""

from sqlalchemy.ext.asyncio import (
    create_async_engine, AsyncSession, async_sessionmaker
)
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


# Async engine — used by FastAPI at runtime
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,

    # Required when connecting via Pg Bouncer
    connect_args = {"statement_cache_size": 0},
    pool_pre_ping=True,
    pool_recycle=300,
)


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
    """

    async with async_session_local() as session:
        yield session
