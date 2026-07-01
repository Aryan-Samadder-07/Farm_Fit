from fastapi import APIRouter, HTTPException, status, Query
from typing import List
from services.notification_service import NotificationService

router = APIRouter(prefix="/api/v1/notifications", tags=["Notification Queue"])

@router.get("")
async def get_notifications(
    unread_only: bool = Query(False, description="Return only unread/undelivered alerts"),
    limit: int = Query(50, ge=1, le=200)
):
    try:
        service = NotificationService()
        notifications = await service.get_notifications(limit=limit, unread_only=unread_only)
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
