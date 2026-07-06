import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone
import asyncio

from app.models.notification import Notification
from app.models.appointment import Appointment
from app.core.config import settings
from app.db.session import async_session_maker

# --- CRUD FUNCTIONS ---

async def get_notification_by_id(db: AsyncSession, notification_id: int) -> Optional[Notification]:
    stmt = select(Notification).where(Notification.id == notification_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_notifications(
    db: AsyncSession,
    user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Notification]:
    stmt = select(Notification)
    if user_id:
        stmt = stmt.where(Notification.user_id == user_id)
    stmt = stmt.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def create_notification_log(
    db: AsyncSession,
    user_id: int,
    appointment_id: Optional[int],
    notification_type: str,  # email, sms, whatsapp
    recipient_address: str,
    message_body: str,
    status: str = "pending"
) -> Notification:
    db_notif = Notification(
        user_id=user_id,
        appointment_id=appointment_id,
        type=notification_type,
        status=status,
        recipient_address=recipient_address,
        message_body=message_body,
        created_at=datetime.now(timezone.utc)
    )
    db.add(db_notif)
    await db.commit()
    await db.refresh(db_notif)
    return db_notif

# --- SMTP CORE ---

def send_smtp_email(to_email: str, subject: str, body_html: str, body_text: str) -> bool:
    """
    Synchronous helper to send standard SMTP emails.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email

        part1 = MIMEText(body_text, "plain")
        part2 = MIMEText(body_html, "html")
        msg.attach(part1)
        msg.attach(part2)

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            if settings.SMTP_PORT == 587:
                server.starttls()
                
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP Dispatch failed to {to_email}: {e}")
        return False

# --- ASYNCHRONOUS NOTIFICATION DISPATCH TASKS ---

async def send_appointment_confirmation_task(appt_id: int):
    """
    Asynchronous task to fetch appointment info and dispatch booking email.
    """
    async with async_session_maker() as db:
        # Load appointment eagerly with relationships
        stmt = (
            select(Appointment)
            .where(Appointment.id == appt_id)
            .options(
                selectinload(Appointment.user),
                selectinload(Appointment.office),
                selectinload(Appointment.service)
            )
        )
        res = await db.execute(stmt)
        appt = res.scalar_one_or_none()
        if not appt or not appt.user.email:
            return

        subject = f"QFlow Booking Confirmation: Appointment #{appt.id}"
        formatted_time = appt.scheduled_time.strftime("%B %d, %Y at %I:%M %p")
        
        body_text = (
            f"Hello {appt.user.full_name},\n\n"
            f"Your appointment has been confirmed.\n"
            f"Office: {appt.office.name} ({appt.office.address})\n"
            f"Service: {appt.service.name}\n"
            f"Time: {formatted_time}\n\n"
            f"To check in when you arrive, please present this code: {appt.qr_code_token}\n\n"
            f"Thank you,\nQFlow Team"
        )
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">QFlow Booking Confirmed</h2>
                <p>Hello <strong>{appt.user.full_name}</strong>,</p>
                <p>Your service appointment has been scheduled successfully.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background: #f8fafc;"><td style="padding: 10px; font-weight: bold;">Office Branch:</td><td style="padding: 10px;">{appt.office.name} ({appt.office.address})</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">Service Type:</td><td style="padding: 10px;">{appt.service.name}</td></tr>
                    <tr style="background: #f8fafc;"><td style="padding: 10px; font-weight: bold;">Scheduled Time:</td><td style="padding: 10px;">{formatted_time}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">Check-In Token:</td><td style="padding: 10px; font-family: monospace; font-weight: bold; color: #4338ca;">{appt.qr_code_token}</td></tr>
                </table>
                <p style="font-size: 13px; color: #64748b;">Self check-in opens 15 minutes before and closes 30 minutes after your time slot.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated notification. Please do not reply.</p>
            </div>
        </body>
        </html>
        """

        # Log pending in db
        notif = await create_notification_log(
            db, appt.user_id, appt.id, "email", appt.user.email, body_text, "pending"
        )

        # Send
        success = await asyncio.to_thread(
            send_smtp_email, appt.user.email, subject, body_html, body_text
        )

        if success:
            notif.status = "sent"
            notif.sent_at = datetime.now(timezone.utc)
            # Log console debug fallback print
            print(f"[SMTP SEND SUCCESS] Confirmation sent to {appt.user.email}")
        else:
            notif.status = "failed"
            print(f"[SMTP SEND FAILED] Confirmation fallback logging: To: {appt.user.email} - Token: {appt.qr_code_token}")

        db.add(notif)
        await db.commit()

async def send_appointment_cancellation_task(appt_id: int):
    """
    Asynchronous task to dispatch cancellation email.
    """
    async with async_session_maker() as db:
        stmt = (
            select(Appointment)
            .where(Appointment.id == appt_id)
            .options(
                selectinload(Appointment.user),
                selectinload(Appointment.office),
                selectinload(Appointment.service)
            )
        )
        res = await db.execute(stmt)
        appt = res.scalar_one_or_none()
        if not appt or not appt.user.email:
            return

        subject = f"QFlow Cancellation: Appointment #{appt.id}"
        formatted_time = appt.scheduled_time.strftime("%B %d, %Y at %I:%M %p")
        
        body_text = (
            f"Hello {appt.user.full_name},\n\n"
            f"Your appointment has been cancelled.\n"
            f"Office: {appt.office.name}\n"
            f"Service: {appt.service.name}\n"
            f"Original Time: {formatted_time}\n\n"
            f"If this was a mistake, please schedule a new slot.\n\n"
            f"Thank you,\nQFlow Team"
        )
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="color: #ef4444; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">QFlow Appointment Cancelled</h2>
                <p>Hello <strong>{appt.user.full_name}</strong>,</p>
                <p>This email confirms that your appointment scheduled for {formatted_time} at <strong>{appt.office.name}</strong> has been cancelled.</p>
                <p style="font-size: 13px; color: #64748b;">No further action is required.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">QFlow automated notifications desk.</p>
            </div>
        </body>
        </html>
        """

        notif = await create_notification_log(
            db, appt.user_id, appt.id, "email", appt.user.email, body_text, "pending"
        )

        success = await asyncio.to_thread(
            send_smtp_email, appt.user.email, subject, body_html, body_text
        )

        if success:
            notif.status = "sent"
            notif.sent_at = datetime.now(timezone.utc)
            print(f"[SMTP SEND SUCCESS] Cancellation sent to {appt.user.email}")
        else:
            notif.status = "failed"
            print(f"[SMTP SEND FAILED] Cancellation fallback logging: To: {appt.user.email}")

        db.add(notif)
        await db.commit()

async def send_check_in_confirmation_task(appt_id: int, position: int, estimated_wait: int):
    """
    Asynchronous task to notify customer of successful check-in and queue placement.
    """
    async with async_session_maker() as db:
        stmt = (
            select(Appointment)
            .where(Appointment.id == appt_id)
            .options(
                selectinload(Appointment.user),
                selectinload(Appointment.office),
                selectinload(Appointment.service)
            )
        )
        res = await db.execute(stmt)
        appt = res.scalar_one_or_none()
        if not appt or not appt.user.email:
            return

        # Format ticket number from service initials
        svc_name = appt.service.name
        prefix = "".join([w[0] for w in svc_name.split() if w[0].isalnum()]).upper()[:2]
        if not prefix:
            prefix = "TK"
        ticket_number = f"{prefix}-{position}"

        subject = f"QFlow Checked In: Ticket {ticket_number}"
        
        body_text = (
            f"Hello {appt.user.full_name},\n\n"
            f"You have checked in successfully for your appointment.\n"
            f"Your queue ticket is: {ticket_number}\n"
            f"Estimated wait time: {estimated_wait} minutes.\n\n"
            f"Please keep an eye on the lobby queue display board.\n\n"
            f"Thank you,\nQFlow Team"
        )
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="color: #10b981; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">QFlow Ticket Checked In</h2>
                <p>Hello <strong>{appt.user.full_name}</strong>,</p>
                <p>You are now active in the virtual queue.</p>
                <div style="background: #ecfdf5; border: 1px dashed #10b981; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                    <div style="font-size: 13px; color: #047857; font-weight: bold;">YOUR TICKET NUMBER</div>
                    <div style="font-size: 36px; font-weight: 900; color: #065f46; margin: 8px 0;">{ticket_number}</div>
                    <div style="font-size: 13px; color: #047857;">Est. Wait: <strong>{estimated_wait} minutes</strong></div>
                </div>
                <p style="font-size: 13px; color: #64748b;">Please proceed to the lobby area. We will call you when a serving officer becomes available.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">QFlow automated notifications desk.</p>
            </div>
        </body>
        </html>
        """

        notif = await create_notification_log(
            db, appt.user_id, appt.id, "email", appt.user.email, body_text, "pending"
        )

        success = await asyncio.to_thread(
            send_smtp_email, appt.user.email, subject, body_html, body_text
        )

        if success:
            notif.status = "sent"
            notif.sent_at = datetime.now(timezone.utc)
            print(f"[SMTP SEND SUCCESS] Check-in sent to {appt.user.email}")
        else:
            notif.status = "failed"
            print(f"[SMTP SEND FAILED] Check-in fallback: To: {appt.user.email} - Ticket: {ticket_number}")

        db.add(notif)
        await db.commit()

async def send_ticket_called_task(appt_id: int, ticket_number: str, counter_name: str):
    """
    Asynchronous task to notify customer that their ticket has been called to a counter.
    """
    async with async_session_maker() as db:
        stmt = (
            select(Appointment)
            .where(Appointment.id == appt_id)
            .options(
                selectinload(Appointment.user),
                selectinload(Appointment.office)
            )
        )
        res = await db.execute(stmt)
        appt = res.scalar_one_or_none()
        if not appt or not appt.user.email:
            return

        subject = f"URGENT: Ticket {ticket_number} Called to {counter_name}"
        
        body_text = (
            f"Hello {appt.user.full_name},\n\n"
            f"Your ticket {ticket_number} has been called!\n"
            f"Please proceed to: {counter_name} immediately.\n\n"
            f"Thank you,\nQFlow Team"
        )
        
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="color: #d97706; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">QFlow: You are Called!</h2>
                <p>Hello <strong>{appt.user.full_name}</strong>,</p>
                <p>Your ticket is now active at the counter desk.</p>
                <div style="background: #fffbeb; border: 1px dashed #d97706; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
                    <div style="font-size: 13px; color: #92400e; font-weight: bold;">TICKET NUMBER</div>
                    <div style="font-size: 32px; font-weight: 900; color: #78350f; margin: 8px 0;">{ticket_number}</div>
                    <div style="font-size: 15px; color: #b45309; font-weight: bold;">PROCEED IMMEDIATELY TO: {counter_name}</div>
                </div>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">QFlow automated notifications desk.</p>
            </div>
        </body>
        </html>
        """

        notif = await create_notification_log(
            db, appt.user_id, appt.id, "email", appt.user.email, body_text, "pending"
        )

        success = await asyncio.to_thread(
            send_smtp_email, appt.user.email, subject, body_html, body_text
        )

        if success:
            notif.status = "sent"
            notif.sent_at = datetime.now(timezone.utc)
            print(f"[SMTP SEND SUCCESS] Ticket Called sent to {appt.user.email}")
        else:
            notif.status = "failed"
            print(f"[SMTP SEND FAILED] Ticket Called fallback: To: {appt.user.email} - Counter: {counter_name}")

        db.add(notif)
        await db.commit()

# --- TRIGGER RESEND DISPATCH ---

async def trigger_resend(db: AsyncSession, notification_id: int) -> bool:
    """
    Manually retry sending a failed email notification.
    """
    notif = await get_notification_by_id(db, notification_id)
    if not notif or notif.type != "email":
        return False
        
    subject = f"QFlow Status Update Alert"
    body_text = notif.message_body
    
    # Simple plain text to HTML envelope
    body_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
            <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">QFlow Notification Resend</h2>
            <p>{notif.message_body.replace('\n', '<br>')}</p>
        </div>
    </body>
    </html>
    """

    success = await asyncio.to_thread(
        send_smtp_email, notif.recipient_address, subject, body_html, body_text
    )

    if success:
        notif.status = "sent"
        notif.sent_at = datetime.now(timezone.utc)
        db.add(notif)
        await db.commit()
        return True
    return False
