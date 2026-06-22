"""
Email configuration module
"""
import asyncio
import resend
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY


async def send_verification_email(email: str, otp: str) -> None:
    """
    Send Verification email with otp to users
    """
    html_content = f"""
        <h2>Welcome to AkuMart</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing: 4px;">{otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not create an account, ignore this email.</p>
    """

    params = {
        "from": f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>",
        "to": [email],
        "subject": "Verify your AkuMart account",
        "html": html_content,
    }

    # resend's SDK is synchronous, so run it off the event loop
    await asyncio.to_thread(resend.Emails.send, params)


async def send_email_verification_notification(email: str, role_link: str) -> None:
    """
    Send Email to Notify newly verified users that their email has been verified.
    """

    role_selection_link = role_link
    html_content = f"""
        <h2>Welcome to AkuMart 🎉</h2>
        <p>Your email has been successfully verified.</p>

        <p>You're just one step away from getting started on AkuMart.</p>

        <p>Please select your preferred role to complete your account setup:</p>

        <p>
            <a href="{role_selection_link}"
               style="
                display: inline-block;
                padding: 12px 24px;
                background-color: #16a34a;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
            ">
            Choose Your Role
            </a>
        </p>

        <p>You can register as a <strong>Buyer</strong> to discover products and services, 
           or as a <strong>Seller</strong> to showcase and grow your business on AkuMart.
        </p>

        <p>If you did not create this account, please contact support immediately.</p>

        <p>Thank you for joining AkuMart!</p>
    """

    params = {
        "from": f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>",
        "to": [email],
        "subject": "Email Verified Successfully: Complete Your AkuMart Profile",
        "html": html_content,
    }

    await asyncio.to_thread(resend.Emails.send, params)
