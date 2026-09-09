from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time
import uuid
from utils.jwt_handler import get_current_user
from services.facility_service import FacilityService, haversine_distance, DEFAULT_LAT, DEFAULT_LON
from database import (
    db, 
    healthcare_facilities_collection, 
    ambulances_collection, 
    ambulance_bookings_collection,
    notifications_collection,
    profile_collection
)

router = APIRouter()

SEED_AMBULANCES = [
    {
        "ambulance_id": "AMB-108-01",
        "vehicle_type": "Advanced Life Support (ALS) Ambulance",
        "operator": "108 EMRI Emergency Response Fleet",
        "base_facility_id": "FAC-001",
        "base_facility_name": "Sanjeevani District Civil Hospital",
        "latitude": 19.0820,
        "longitude": 72.8890,
        "status": "Available",
        "equipment": ["Ventilator", "Defibrillator", "Oxygen Support", "Paramedic Crew"],
        "emergency_phone": "108",
        "last_updated": time.time() - 900
    },
    {
        "ambulance_id": "AMB-108-02",
        "vehicle_type": "Basic Life Support (BLS) Ambulance",
        "operator": "108 EMRI Rural Response",
        "base_facility_id": "FAC-002",
        "base_facility_name": "Gramin PHC Badlapur",
        "latitude": 19.1650,
        "longitude": 73.2380,
        "status": "Available",
        "equipment": ["Oxygen Cylinder", "Stretcher", "First Aid Kit", "EMT Staff"],
        "emergency_phone": "108",
        "last_updated": time.time() - 1800
    },
    {
        "ambulance_id": "AMB-108-03",
        "vehicle_type": "Cardiac & Trauma ICU Ambulance",
        "operator": "108 Emergency Medical Services",
        "base_facility_id": "FAC-004",
        "base_facility_name": "Apex Specialty Multi-Care Hospital",
        "latitude": 19.0550,
        "longitude": 72.8310,
        "status": "Available",
        "equipment": ["ECG Monitor", "Automated CPR", "ALS Paramedics", "Trauma Kit"],
        "emergency_phone": "108",
        "last_updated": time.time() - 3600
    },
    {
        "ambulance_id": "AMB-108-04",
        "vehicle_type": "Maternal & Neonatal Emergency Unit",
        "operator": "108 Janani Shishu Response",
        "base_facility_id": "FAC-003",
        "base_facility_name": "Community Health Centre (CHC) Karjat",
        "latitude": 18.9100,
        "longitude": 73.3280,
        "status": "Available",
        "equipment": ["Incubator", "Delivery Kit", "Oxygen Unit", "Nurse Specialist"],
        "emergency_phone": "108",
        "last_updated": time.time() - 7200
    }
]

async def ensure_ambulances_seeded():
    try:
        count = await ambulances_collection.count_documents({})
        if count == 0:
            print("Seeding ambulances collection with state 108 emergency fleet records...")
            await ambulances_collection.insert_many(SEED_AMBULANCES)
    except Exception as e:
        print(f"Error seeding ambulances: {e}")


class BookAmbulanceRequest(BaseModel):
    ambulance_id: str
    pickup_address: str
    pickup_latitude: Optional[float] = DEFAULT_LAT
    pickup_longitude: Optional[float] = DEFAULT_LON
    emergency_type: Optional[str] = "Critical Medical Emergency"
    contact_phone: Optional[str] = "+91 98000 00000"
    patient_notes: Optional[str] = None

class UpdateAmbulanceStatusRequest(BaseModel):
    status: str # Available, Requested, Assigned, En Route, Arrived, Completed, Offline
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    notes: Optional[str] = None


@router.get("/ambulances")
async def get_emergency_ambulances(
    user_lat: Optional[float] = Query(DEFAULT_LAT),
    user_lon: Optional[float] = Query(DEFAULT_LON),
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve database-backed ambulance fleet records with distance scoring and live status."""
    await ensure_ambulances_seeded()
    
    query = {}
    if status_filter:
        query["status"] = status_filter

    cursor = ambulances_collection.find(query, {"_id": 0})
    ambulances = []
    async for doc in cursor:
        dist_km = haversine_distance(
            user_lat or DEFAULT_LAT,
            user_lon or DEFAULT_LON,
            doc.get("latitude", DEFAULT_LAT),
            doc.get("longitude", DEFAULT_LON)
        )
        doc["distance_km"] = dist_km
        ambulances.append(doc)

    ambulances.sort(key=lambda x: x["distance_km"])

    return {
        "ambulances": ambulances,
        "data_source": "MongoDB State 108 Emergency Fleet Registry",
        "dispatch_helplines": {
            "state_ambulance": "108",
            "national_emergency": "112"
        },
        "disclaimer": "Emergency fleet status is retrieved from database registry. Dial 108 immediately for urgent ambulance dispatch.",
        "timestamp": time.time()
    }


@router.post("/ambulances/book")
async def book_ambulance(
    request: BookAmbulanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Patient books an ambulance.
    Enforces atomic status transition from 'Available' to 'Requested' to prevent double booking.
    """
    await ensure_ambulances_seeded()
    patient_email = current_user["sub"]

    # Concurrency Lock: Find and atomically update if and only if status is Available
    result = await ambulances_collection.find_one_and_update(
        {"ambulance_id": request.ambulance_id, "status": "Available"},
        {"$set": {
            "status": "Requested",
            "last_updated": time.time()
        }},
        return_document=True
    )

    if not result:
        # Check if ambulance exists but is busy
        amb = await ambulances_collection.find_one({"ambulance_id": request.ambulance_id})
        if amb:
            raise HTTPException(
                status_code=409, 
                detail=f"Ambulance {request.ambulance_id} is currently {amb.get('status')}. Please select another available vehicle."
            )
        raise HTTPException(status_code=404, detail="Ambulance not found.")

    booking_id = f"AMBBK-{uuid.uuid4().hex[:8].upper()}"
    profile = await profile_collection.find_one({"email": patient_email})
    patient_name = profile.get("name") if profile else current_user.get("name", "Citizen")

    booking_doc = {
        "booking_id": booking_id,
        "ambulance_id": request.ambulance_id,
        "vehicle_type": result.get("vehicle_type"),
        "operator": result.get("operator"),
        "base_facility_id": result.get("base_facility_id"),
        "base_facility_name": result.get("base_facility_name"),
        "patient_email": patient_email,
        "patient_name": patient_name,
        "contact_phone": request.contact_phone,
        "pickup_address": request.pickup_address,
        "pickup_latitude": request.pickup_latitude,
        "pickup_longitude": request.pickup_longitude,
        "emergency_type": request.emergency_type,
        "patient_notes": request.patient_notes,
        "status": "Requested", # Requested -> Assigned -> En Route -> Arrived -> Completed
        "created_at": time.time(),
        "updated_at": time.time()
    }

    await ambulance_bookings_collection.insert_one(booking_doc)

    # In-app notification for hospital / fleet dispatcher
    fac = await healthcare_facilities_collection.find_one({"facility_id": result.get("base_facility_id")})
    if fac and fac.get("admin_email"):
        await notifications_collection.insert_one({
            "recipient_email": fac["admin_email"],
            "recipient_role": "hospital",
            "facility_id": result.get("base_facility_id"),
            "title": "🚨 Emergency Ambulance Request!",
            "message": f"New ambulance request for {request.emergency_type} at {request.pickup_address}.",
            "booking_id": booking_id,
            "timestamp": time.time(),
            "read": False
        })

    booking_doc.pop("_id", None)
    return {
        "message": "Ambulance requested successfully. Dispatch team alerted.",
        "booking": booking_doc
    }


@router.get("/ambulances/my-requests")
async def get_my_ambulance_requests(
    current_user: dict = Depends(get_current_user)
):
    """Retrieve active ambulance requests for current patient."""
    email = current_user["sub"]
    cursor = ambulance_bookings_collection.find({"patient_email": email}, {"_id": 0}).sort("created_at", -1)
    requests = []
    async for r in cursor:
        requests.append(r)
    return requests


@router.get("/ambulances/requests")
async def get_all_ambulance_requests(
    current_user: dict = Depends(get_current_user)
):
    """Hospital / Dispatcher views incoming ambulance requests."""
    role = current_user.get("role", "patient")
    email = current_user["sub"]

    query = {}
    if role == "hospital":
        fac = await healthcare_facilities_collection.find_one({"admin_email": email})
        if fac:
            query["base_facility_id"] = fac["facility_id"]

    cursor = ambulance_bookings_collection.find(query, {"_id": 0}).sort("created_at", -1)
    requests = []
    async for r in cursor:
        requests.append(r)
    return requests


@router.put("/ambulances/{ambulance_id}/status")
async def update_ambulance_status(
    ambulance_id: str,
    request: UpdateAmbulanceStatusRequest,
    current_user: dict = Depends(get_current_user)
):
    """Hospital or Driver updates ambulance status (e.g. En Route, Arrived, Completed, Available)."""
    amb = await ambulances_collection.find_one({"ambulance_id": ambulance_id})
    if not amb:
        raise HTTPException(status_code=404, detail="Ambulance record not found.")

    new_status = request.status
    update_fields: Dict[str, Any] = {
        "status": new_status,
        "last_updated": time.time()
    }
    if request.location_latitude is not None and request.location_longitude is not None:
        update_fields["latitude"] = request.location_latitude
        update_fields["longitude"] = request.location_longitude

    await ambulances_collection.update_one(
        {"ambulance_id": ambulance_id},
        {"$set": update_fields}
    )

    # Also update any active booking for this ambulance
    active_booking = await ambulance_bookings_collection.find_one(
        {"ambulance_id": ambulance_id, "status": {"$ne": "Completed"}},
        sort=[("created_at", -1)]
    )
    if active_booking:
        booking_status = new_status if new_status != "Available" else "Completed"
        await ambulance_bookings_collection.update_one(
            {"_id": active_booking["_id"]},
            {"$set": {"status": booking_status, "updated_at": time.time()}}
        )

        # Notify patient
        await notifications_collection.insert_one({
            "recipient_email": active_booking["patient_email"],
            "recipient_role": "patient",
            "title": f"Ambulance Update: {booking_status} 🚑",
            "message": f"Ambulance {ambulance_id} is now {booking_status}.",
            "booking_id": active_booking.get("booking_id"),
            "timestamp": time.time(),
            "read": False
        })

    return {"message": f"Ambulance {ambulance_id} status updated to {new_status}."}


@router.get("/facilities")
async def get_emergency_facilities(
    user_lat: Optional[float] = Query(DEFAULT_LAT),
    user_lon: Optional[float] = Query(DEFAULT_LON),
    current_user: dict = Depends(get_current_user)
):
    """Retrieve 24/7 emergency-capable database facilities sorted by distance & ICU readiness."""
    all_facilities = await FacilityService.get_all_facilities()
    emergency_facilities = []
    
    for fac in all_facilities:
        if fac.get("emergency_24_7") or fac.get("has_icu"):
            dist = haversine_distance(
                user_lat or DEFAULT_LAT, 
                user_lon or DEFAULT_LON, 
                fac.get("latitude", DEFAULT_LAT), 
                fac.get("longitude", DEFAULT_LON)
            )
            fac_copy = dict(fac)
            fac_copy["distance_km"] = dist
            emergency_facilities.append(fac_copy)

    emergency_facilities.sort(key=lambda x: x["distance_km"])

    return {
        "facilities": emergency_facilities,
        "count": len(emergency_facilities),
        "data_source": "MongoDB SwasthyaSetu Facilities Registry",
        "timestamp": time.time()
    }
