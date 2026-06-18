"""
OTP (One-Time Password) management core utilities.

This module handles the generation, storage, validation, and rate-limiting
of short-lived OTPs using Redis.
"""

import random
from app.core.redis import redis_client

OTP_TTL = 600
RESEND_LIMIT = 3
RESEND_WINDOW = 3600


def generate_otp() -> str:
    """Generate a random 6-digit numeric OTP string."""
    return str(random.randint(100000, 999999))


async def store_otp(user_id: str, otp: str) -> None:
    """
    Store the generated OTP in Redis with a fixed TTL.
    """

    await redis_client.setex(f"otp:{user_id}", OTP_TTL, otp)


async def verify_otp(user_id: str, otp: str) -> bool:
    """
    Verify the provided OTP against the one stored in Redis.

    Deletes the OTP upon a successful match to ensure single-use validity
    """

    stored = await redis_client.get(f"otp:{user_id}")
    if not stored or stored != otp:
        return False
    await redis_client.delete(f"otp:{user_id}")
    return True


async def check_resend_rate_limit(user_id: str) -> bool:
    """
    Check if the user has exceeded their OTP resend allowance.

    Tracks resend count within a rolling sliding window using Redis
    """

    key = f"otp_resend:{user_id}"
    count = await redis_client.get(key)

    if count is None:
        await redis_client.setex(key, RESEND_WINDOW, 1)
        return True

    if int(count) >= RESEND_LIMIT:
        return False

    await redis_client.incr(key)
    return True
