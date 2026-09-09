from fastapi import APIRouter
import time

router = APIRouter()

@router.get("")
@router.get("/")
async def health_check():
    """
    Lightweight health ping endpoint for offline/online heartbeat detection.
    Does not perform heavy database calls.
    """
    return {
        "status": "ok",
        "service": "SwasthyaSetu AI",
        "timestamp": int(time.time() * 1000)
    }
