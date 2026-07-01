"""
Alerts router — exposes the in-memory outbound notification log for frontend polling.
"""
import logging
from fastapi import APIRouter, Query
from services.notification_service import NotificationService

logger = logging.getLogger("alerts_route")
router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])

# Shared service instance
_notification_service = NotificationService()


@router.get("/log")
async def get_alert_log(
    limit: int = Query(20, ge=1, le=50, description="Number of recent alerts to return"),
):
    """
    Returns the most recent outbound alerts dispatched by the notification service.
    The frontend polls this endpoint every few seconds to update the live alert log panel.
    Alerts are stored in a module-level deque inside notification_service.OUTBOUND_LOG.
    """
    from services.notification_service import OUTBOUND_LOG
    alerts = list(OUTBOUND_LOG)[:limit]
    return {
        "count": len(alerts),
        "alerts": alerts,
    }
