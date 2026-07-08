from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from services.notification_service import NotificationService
from services.email_service import EmailService

router = APIRouter(prefix="/api/v1/notifications", tags=["Notification Queue"])

@router.get("")
async def get_notifications(
    unread_only: bool = Query(False, description="Return only unread/undelivered alerts"),
    limit: int = Query(50, ge=1, le=200),
    email: Optional[str] = Query(None, description="Optional email to filter alerts targeted to a user")
):
    try:
        service = NotificationService()
        notifications = await service.get_notifications(limit=limit, unread_only=unread_only, email=email)
        unread_count = sum(1 for n in notifications if not n["delivered"])
        return {"notifications": notifications, "total": len(notifications), "unread": unread_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{alert_id}/read")
async def mark_notification_read(alert_id: str):
    try:
        service = NotificationService()
        ok = await service.mark_delivered(alert_id)
        return {"success": ok, "alert_id": alert_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mark-all-read")
async def mark_all_notifications_read():
    try:
        service = NotificationService()
        count = await service.mark_all_delivered()
        return {"success": True, "marked_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Test email endpoint (used by the Notifications dashboard panel) ───────────

class SendTestEmailRequest(BaseModel):
    alert_type: str = Field(default="SYSTEM", description="Alert type key")
    title: str = Field(..., description="Alert headline")
    message: str = Field(..., description="Alert body text")
    severity: str = Field(default="HIGH", description="CRITICAL | HIGH | INFO")
    location: Optional[str] = Field(default="", description="Location string")
    recipient_email: Optional[str] = Field(default="", description="Override recipient; uses ALERT_EMAIL_RECIPIENT if blank")


@router.post("/send-test-email")
async def send_test_alert_email(req: SendTestEmailRequest):
    """
    Sends a test alert email via Gmail SMTP.
    Useful for verifying SMTP configuration and previewing alert email templates.
    """
    email_service = EmailService()
    try:
        success = email_service.send_alert_notification(
            alert_type=req.alert_type,
            title=req.title,
            message=req.message,
            severity=req.severity,
            location=req.location or "",
            recipient_email=req.recipient_email or "",
        )
        if success:
            return {
                "success": True,
                "message": "Test alert email sent successfully via Gmail SMTP."
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Email service returned failure. Check SMTP credentials in .env."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email send failed: {str(e)}")
