"""
Email configuration module
"""
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.core.config import settings

mail_config = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)

fastmail = FastMail(mail_config)


async def send_verification_email(email: str, otp: str) -> None:
    """
    Send Verification email with otp to users
    """

    message = MessageSchema(
        subject="Verify your AkuMart account",
        recipients=[email],
        body=f"""
            <h2>Welcome to AkuMart</h2>
            <p>Your verification code is:</p>
            <h1 style="letter-spacing: 4px;">{otp}</h1>
            <p>This code expires in 10 minutes.</p>
            <p>If you did not create an account, ignore this email.</p>
        """,
        subtype=MessageType.html,
    )
    await fastmail.send_message(message)
