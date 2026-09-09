from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time
from utils.jwt_handler import get_current_user
from services.ai_service import AIService
from services.facility_service import FacilityService, DEFAULT_LAT, DEFAULT_LON
from database import referrals_history_collection, healthcare_facilities_collection

router = APIRouter()


class LocationModel(BaseModel):
    latitude: Optional[float] = DEFAULT_LAT
    longitude: Optional[float] = DEFAULT_LON
    address: Optional[str] = "Current Location"


class ReferralRequest(BaseModel):
    triage_result: Dict[str, Any] = Field(..., description="Triage output containing urgency_level, summary, etc.")
    user_input: Dict[str, Any] = Field(..., description="Patient symptoms input containing main_symptom, age_group, etc.")
    location: Optional[LocationModel] = None


class StatusUpdateModel(BaseModel):
    status: Optional[str] = None
    available_beds: Optional[int] = None
    icu_beds_available: Optional[int] = None
    is_24x7_emergency: Optional[bool] = None
    set_stale_data: Optional[bool] = False  # If True, sets last_updated to 48 hours ago for testing


CITY_COORDINATES = {
    "mumbai": (19.0760, 72.8777),
    "bandra": (19.0550, 72.8310),
    "badlapur": (19.1650, 73.2380),
    "karjat": (18.9100, 73.3280),
    "ghatkopar": (19.1100, 72.9000),
    "shahapur": (19.2100, 73.1500),
    "thane": (19.2183, 72.9781),
    "navi mumbai": (19.0330, 73.0297)
}


@router.post("/recommend")
async def generate_care_pathway(
    request: ReferralRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        user_lat = DEFAULT_LAT
        user_lon = DEFAULT_LON
        is_approximate_location = False

        location_str = str(request.user_input.get("location") or (request.location.address if request.location else "")).lower().strip()
        
        # Check if user entered a specific city name
        matched_city = None
        for city_key, coords in CITY_COORDINATES.items():
            if city_key in location_str:
                user_lat, user_lon = coords
                matched_city = city_key
                break

        if request.location and request.location.latitude is not None and request.location.longitude is not None:
            # Explicit lat/lon passed
            if request.location.latitude != DEFAULT_LAT or request.location.longitude != DEFAULT_LON:
                user_lat = request.location.latitude
                user_lon = request.location.longitude
                is_approximate_location = False
            elif matched_city:
                is_approximate_location = True
        else:
            is_approximate_location = True

        # 1. Determine service category using AI
        service_analysis = await AIService.determine_required_services(
            request.triage_result,
            request.user_input
        )

        primary_service = service_analysis.get("primary_required_service", "General consultation")
        urgency_level = request.triage_result.get("urgency_level", "URGENT")

        # 2. Server-side facility matching & ranking (Facility availability comes strictly from database)
        care_pathway = await FacilityService.recommend_care_pathway(
            required_service=primary_service,
            urgency_level=urgency_level,
            user_lat=user_lat,
            user_lon=user_lon
        )

        # 3. Assemble full response object
        response_payload = {
            "triage_summary": request.triage_result.get("summary", ""),
            "urgency_level": urgency_level,
            "red_flag_triggered": request.triage_result.get("red_flag_triggered", False),
            "service_analysis": service_analysis,
            "care_pathway": care_pathway,
            "disclaimer": request.triage_result.get("disclaimer", "Preliminary healthcare navigation only. Not a medical diagnosis."),
            "timestamp": time.time()
        }

        # 4. Securely persist referral record in DB bound to patient user_email
        history_doc = {
            "user_email": current_user["sub"],
            "input_symptom": request.user_input.get("main_symptom", ""),
            "urgency_level": urgency_level,
            "primary_service": primary_service,
            "recommended_facility_id": care_pathway.get("best_match", {}).get("facility", {}).get("facility_id") if care_pathway.get("best_match") else None,
            "recommended_facility_name": care_pathway.get("best_match", {}).get("facility", {}).get("name") if care_pathway.get("best_match") else "None (Fallback)",
            "response": response_payload,
            "timestamp": time.time()
        }

        try:
            await referrals_history_collection.insert_one(history_doc)
        except Exception as db_err:
            print(f"Warning: Failed to persist referral history record: {db_err}")

        return response_payload

    except Exception as e:
        print(f"Error generating care pathway recommendation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate care pathway: {str(e)}"
        )


@router.get("/facilities")
async def list_healthcare_facilities(
    service: Optional[str] = Query(None, description="Filter by service name"),
    emergency_only: Optional[bool] = Query(False, description="Filter 24x7 emergency facilities"),
    current_user: dict = Depends(get_current_user)
):
    try:
        facilities = await FacilityService.get_all_facilities()
        filtered = facilities

        if emergency_only:
            filtered = [f for f in filtered if f.get("is_24x7_emergency")]

        if service:
            svc_lower = service.lower()
            filtered = [f for f in filtered if any(svc_lower in s.lower() for s in f.get("services", []))]

        return filtered
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_patient_referral_history(
    current_user: dict = Depends(get_current_user)
):
    """Securely retrieve authenticated patient's own referral history."""
    try:
        cursor = referrals_history_collection.find(
            {"user_email": current_user["sub"]}
        ).sort("timestamp", -1).limit(20)

        history = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            history.append(doc)

        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/facilities/{facility_id}/status")
async def update_facility_data(
    facility_id: str,
    update: StatusUpdateModel,
    current_user: dict = Depends(get_current_user)
):
    """Admin / Testing utility to modify facility status and simulate stale data."""
    try:
        updates = {}
        if update.status:
            updates["status"] = update.status
        if update.available_beds is not None:
            updates["available_beds"] = update.available_beds
        if update.icu_beds_available is not None:
            updates["icu_beds_available"] = update.icu_beds_available
        if update.is_24x7_emergency is not None:
            updates["is_24x7_emergency"] = update.is_24x7_emergency

        if update.set_stale_data:
            # Set timestamp to 48 hours ago
            updates["last_updated"] = time.time() - 172800
        else:
            updates["last_updated"] = time.time()

        updated_doc = await FacilityService.update_facility_status(facility_id, updates)
        if not updated_doc:
            raise HTTPException(status_code=404, detail="Facility not found")

        return {"message": "Facility status updated successfully", "facility": updated_doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
