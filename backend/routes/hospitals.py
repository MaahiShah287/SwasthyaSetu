from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time
import uuid
from utils.jwt_handler import get_current_user
from database import (
    db, 
    healthcare_facilities_collection, 
    hospital_bookings_collection, 
    ambulances_collection, 
    doctors_collection,
    notifications_collection,
    users_collection,
    profile_collection
)
from services.facility_service import FacilityService, haversine_distance, DEFAULT_LAT, DEFAULT_LON

router = APIRouter()

class UpdateAvailabilityRequest(BaseModel):
    general_available: int
    icu_available: int
    emergency_available: int
    emergency_24_7: Optional[bool] = True
    departments: Optional[List[str]] = None
    services: Optional[List[str]] = None
    operating_hours: Optional[str] = None
    phone: Optional[str] = None

class BookHospitalSlotRequest(BaseModel):
    facility_id: str
    booking_type: str = "OPD Appointment" # OPD Appointment, Emergency Bed Admission, ICU Reservation, Diagnostic Test
    department: Optional[str] = "General Medicine"
    preferred_date: str
    preferred_time: Optional[str] = "10:00 AM"
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_age: Optional[int] = 25
    patient_gender: Optional[str] = "Other"
    medical_reason: Optional[str] = "General Consultation"
    urgency: Optional[str] = "ROUTINE" # ROUTINE, URGENT, EMERGENCY

class UpdateBookingStatusRequest(BaseModel):
    status: str # APPROVED, REJECTED, ADMITTED, DISCHARGED, CANCELLED
    notes: Optional[str] = None
    allocated_bed_number: Optional[str] = None

@router.get("/")
async def get_all_hospitals(
    department: Optional[str] = None,
    city: Optional[str] = None,
    facility_type: Optional[str] = None,
    category: Optional[str] = None,
    emergency_only: Optional[bool] = False,
    user_lat: Optional[float] = Query(DEFAULT_LAT),
    user_lon: Optional[float] = Query(DEFAULT_LON),
    current_user: dict = Depends(get_current_user)
):
    """Retrieve list of healthcare facilities with live bed availability and search filters."""
    # Ensure seed facilities if none exist
    all_facilities = await FacilityService.get_all_facilities()
    
    query: Dict[str, Any] = {}
    if department:
        query["departments"] = {"$regex": department, "$options": "i"}
    if city and city.lower() != "all":
        query["$or"] = [
            {"city": {"$regex": city, "$options": "i"}},
            {"district": {"$regex": city, "$options": "i"}},
            {"address": {"$regex": city, "$options": "i"}}
        ]
    if emergency_only:
        query["emergency_24_7"] = True

    type_filter = facility_type or category
    if type_filter and type_filter.lower() != "all":
        tf_lower = type_filter.lower()
        if "vaccin" in tf_lower:
            query["$or"] = [
                {"facility_type": "vaccination_centre"},
                {"category": {"$regex": "vaccination", "$options": "i"}},
                {"type": {"$regex": "vaccination", "$options": "i"}},
                {"services": {"$regex": "vaccin|immunization", "$options": "i"}}
            ]
        elif "phc" in tf_lower:
            query["$or"] = [
                {"facility_type": "phc"},
                {"category": "PHC"},
                {"type": {"$regex": "primary health", "$options": "i"}}
            ]
        elif "chc" in tf_lower:
            query["$or"] = [
                {"facility_type": "chc"},
                {"category": "CHC"},
                {"type": {"$regex": "community health", "$options": "i"}}
            ]
        elif "sub" in tf_lower:
            query["$or"] = [
                {"facility_type": "sub_centre"},
                {"category": "Sub-Centre"},
                {"type": {"$regex": "sub-centre|sub centre", "$options": "i"}}
            ]
        elif "hospital" in tf_lower:
            query["$or"] = [
                {"facility_type": "hospital"},
                {"category": "Hospital"},
                {"type": {"$regex": "hospital", "$options": "i"}}
            ]

    cursor = healthcare_facilities_collection.find(query, {"_id": 0})
    facilities = []
    async for f in cursor:
        dist_km = haversine_distance(
            user_lat or DEFAULT_LAT,
            user_lon or DEFAULT_LON,
            f.get("latitude", DEFAULT_LAT),
            f.get("longitude", DEFAULT_LON)
        )
        f["distance_km"] = dist_km
        facilities.append(f)

    facilities.sort(key=lambda x: x["distance_km"])
    return {
        "count": len(facilities),
        "facilities": facilities,
        "timestamp": time.time()
    }


@router.get("/nearby")
async def get_nearby_facilities(
    lat: float = Query(..., description="Latitude of user current location"),
    lng: Optional[float] = Query(None, description="Longitude of user current location"),
    lon: Optional[float] = Query(None, description="Longitude of user current location (alias)"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    facility_type: Optional[str] = Query(None, description="Optional facility type filter"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    emergency_only: Optional[bool] = Query(False, description="Filter 24/7 trauma emergency facilities only")
):
    """
    Live Location-Based Healthcare Discovery endpoint.
    Performs geospatial querying against healthcare_facilities collection in MongoDB
    and authoritatively calculates distance from user coordinates.
    Returns facilities within radius_km sorted by distance_km, and includes Shatabdi Hospital, Govandi
    as the stable demo/featured facility record.
    """
    user_lng = lng if lng is not None else lon
    if user_lng is None:
        raise HTTPException(status_code=422, detail="Missing required longitude parameter 'lng' or 'lon'.")

    # Coordinate validation
    if not (-90.0 <= lat <= 90.0):
        raise HTTPException(status_code=400, detail="Invalid latitude. Must be between -90 and 90.")
    if not (-180.0 <= user_lng <= 180.0):
        raise HTTPException(status_code=400, detail="Invalid longitude. Must be between -180 and 180.")

    # Ensure DB is seeded and location fields present
    await FacilityService.ensure_seeded()

    radius_meters = radius_km * 1000.0

    # Build base filter
    base_filter: Dict[str, Any] = {}
    type_filter = facility_type or category
    if type_filter and type_filter.lower() != "all":
        tf_lower = type_filter.lower()
        if "vaccin" in tf_lower:
            base_filter["$or"] = [
                {"facility_type": "vaccination_centre"},
                {"category": {"$regex": "vaccination", "$options": "i"}},
                {"type": {"$regex": "vaccination", "$options": "i"}},
                {"services": {"$regex": "vaccin|immunization", "$options": "i"}}
            ]
        elif "phc" in tf_lower:
            base_filter["$or"] = [
                {"facility_type": "phc"},
                {"category": "PHC"},
                {"type": {"$regex": "primary health", "$options": "i"}}
            ]
        elif "chc" in tf_lower:
            base_filter["$or"] = [
                {"facility_type": "chc"},
                {"category": "CHC"},
                {"type": {"$regex": "community health", "$options": "i"}}
            ]
        elif "sub" in tf_lower:
            base_filter["$or"] = [
                {"facility_type": "sub_centre"},
                {"category": "Sub-Centre"},
                {"type": {"$regex": "sub-centre|sub centre", "$options": "i"}}
            ]
        elif "hospital" in tf_lower:
            base_filter["$or"] = [
                {"facility_type": "hospital"},
                {"category": "Hospital"},
                {"type": {"$regex": "hospital", "$options": "i"}}
            ]

    if emergency_only:
        base_filter["emergency_24_7"] = True

    # MongoDB 2dsphere geospatial query attempt
    geo_query = dict(base_filter)
    geo_query["location"] = {
        "$nearSphere": {
            "$geometry": {
                "type": "Point",
                "coordinates": [user_lng, lat]
            },
            "$maxDistance": radius_meters
        }
    }

    facilities = []
    try:
        cursor = healthcare_facilities_collection.find(geo_query, {"_id": 0})
        async for doc in cursor:
            dist = haversine_distance(
                lat, user_lng,
                doc.get("latitude", DEFAULT_LAT),
                doc.get("longitude", DEFAULT_LON)
            )
            doc["distance_km"] = dist
            facilities.append(doc)
    except Exception:
        # Fallback to in-memory Haversine distance calculation over entire collection
        cursor = healthcare_facilities_collection.find(base_filter, {"_id": 0})
        async for doc in cursor:
            dist = haversine_distance(
                lat, user_lng,
                doc.get("latitude", DEFAULT_LAT),
                doc.get("longitude", DEFAULT_LON)
            )
            if dist <= radius_km:
                doc["distance_km"] = dist
                facilities.append(doc)

    # Sort authoritatively by actual distance server-side
    facilities.sort(key=lambda x: x["distance_km"])

    # Fetch/construct Shatabdi Hospital, Govandi as constant demo facility
    shatabdi_doc = await healthcare_facilities_collection.find_one(
        {"$or": [{"facility_id": "FAC-SHATABDI-GOVANDI"}, {"name": {"$regex": "Shatabdi Hospital", "$options": "i"}}]},
        {"_id": 0}
    )
    if not shatabdi_doc:
        from services.facility_service import SHATABDI_HOSPITAL_GOVANDI
        shatabdi_doc = dict(SHATABDI_HOSPITAL_GOVANDI)

    shatabdi_dist = haversine_distance(
        lat, user_lng,
        shatabdi_doc.get("latitude", 19.0435),
        shatabdi_doc.get("longitude", 72.9090)
    )
    shatabdi_doc["distance_km"] = shatabdi_dist
    shatabdi_doc["is_within_radius"] = shatabdi_dist <= radius_km
    shatabdi_doc["is_demo_facility"] = True
    shatabdi_doc["label"] = "Demo / Featured Facility"

    return {
        "success": True,
        "user_location": {
            "latitude": lat,
            "longitude": user_lng,
            "radius_km": radius_km
        },
        "count": len(facilities),
        "facilities": facilities,
        "featured_demo_facility": shatabdi_doc,
        "timestamp": time.time()
    }

@router.get("/admin/me")
async def get_hospital_dashboard_profile(
    current_user: dict = Depends(get_current_user)
):
    """Fetch logged in hospital administrator's facility profile, live vacancies, and statistics."""
    email = current_user["sub"]
    facility = await healthcare_facilities_collection.find_one({"admin_email": email}, {"_id": 0})
    if not facility:
        # Fallback to facility_id if in token
        fac_id = current_user.get("facility_id")
        if fac_id:
            facility = await healthcare_facilities_collection.find_one({"facility_id": fac_id}, {"_id": 0})
    
    if not facility:
        # Create a default facility linking for this hospital user if first login
        facility_id = f"FAC-{uuid.uuid4().hex[:6].upper()}"
        name = current_user.get("name") or "Apex Multi-Specialty Hospital"
        facility = {
            "facility_id": facility_id,
            "name": name,
            "admin_email": email,
            "phone": "+91 22 2410 7000",
            "type": "Hospital",
            "category": "Multi-Specialty Hospital",
            "address": "Healthcare Corridor, Central District",
            "city": "Mumbai",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "departments": ["General Medicine", "Cardiology", "Emergency", "ICU", "Neurology", "Orthopedics"],
            "services": ["24/7 Emergency", "ICU", "Ambulance", "Pathology Lab", "Radiology", "Pharmacy"],
            "specialists": ["Cardiologist", "Neurologist", "General Physician", "Orthopedic Surgeon"],
            "bed_capacity": {
                "total": 65,
                "general_available": 35,
                "icu_available": 8,
                "emergency_available": 4
            },
            "emergency_24_7": True,
            "has_icu": True,
            "has_telemedicine": True,
            "has_ambulance": True,
            "ambulance_count": 3,
            "operating_hours": "24 Hours / Open All Days",
            "created_at": time.time()
        }
        await healthcare_facilities_collection.insert_one(facility)
        facility.pop("_id", None)

    # Fetch associated ambulances
    fac_id = facility["facility_id"]
    amb_cursor = ambulances_collection.find({"base_facility_id": fac_id}, {"_id": 0})
    ambulances = []
    async for a in amb_cursor:
        ambulances.append(a)

    # If no ambulances found for this hospital, create default fleet
    if not ambulances:
        default_ambs = [
            {
                "ambulance_id": f"AMB-{fac_id[-4:]}-01",
                "vehicle_type": "Advanced Life Support (ALS) Ambulance",
                "operator": f"{facility['name']} Dispatch",
                "base_facility_id": fac_id,
                "base_facility_name": facility["name"],
                "latitude": facility.get("latitude", 19.0760),
                "longitude": facility.get("longitude", 72.8777),
                "status": "Available",
                "emergency_phone": facility.get("phone", "108"),
                "equipment": ["Ventilator", "Oxygen Support", "Paramedic Crew", "Defibrillator"],
                "last_updated": time.time()
            },
            {
                "ambulance_id": f"AMB-{fac_id[-4:]}-02",
                "vehicle_type": "Basic Life Support (BLS) Ambulance",
                "operator": f"{facility['name']} Dispatch",
                "base_facility_id": fac_id,
                "base_facility_name": facility["name"],
                "latitude": facility.get("latitude", 19.0760) + 0.01,
                "longitude": facility.get("longitude", 72.8777) + 0.01,
                "status": "Available",
                "emergency_phone": facility.get("phone", "108"),
                "equipment": ["Oxygen Cylinder", "Stretcher", "First Aid Kit", "EMT Staff"],
                "last_updated": time.time()
            }
        ]
        await ambulances_collection.insert_many(default_ambs)
        ambulances = default_ambs

    # Fetch associated doctors
    doc_cursor = doctors_collection.find({"facility_id": fac_id}, {"_id": 0})
    doctors = []
    async for d in doc_cursor:
        doctors.append(d)

    # Fetch incoming booking counts
    pending_bookings = await hospital_bookings_collection.count_documents({"facility_id": fac_id, "status": "PENDING"})
    active_admissions = await hospital_bookings_collection.count_documents({"facility_id": fac_id, "status": "ADMITTED"})

    cap = facility.get("bed_capacity") or {}
    gen_avail = cap.get("general_available") if cap.get("general_available") is not None else facility.get("available_beds", 25)
    icu_avail = cap.get("icu_available") if cap.get("icu_available") is not None else facility.get("icu_beds_available", 5)
    emg_avail = cap.get("emergency_available") if cap.get("emergency_available") is not None else facility.get("emergency_beds", 4)

    return {
        "facility": facility,
        "ambulances": ambulances,
        "doctors": doctors,
        "stats": {
            "pending_bookings": pending_bookings,
            "active_admissions": active_admissions,
            "general_available": gen_avail,
            "icu_available": icu_avail,
            "emergency_available": emg_avail
        }
    }


@router.put("/admin/availability")
async def update_hospital_availability(
    request: UpdateAvailabilityRequest,
    current_user: dict = Depends(get_current_user)
):
    """Hospital admin endpoint to update bed availability and services."""
    email = current_user["sub"]
    facility = await healthcare_facilities_collection.find_one({"admin_email": email})
    if not facility:
        fac_id = current_user.get("facility_id")
        if fac_id:
            facility = await healthcare_facilities_collection.find_one({"facility_id": fac_id})

    if not facility:
        raise HTTPException(status_code=403, detail="Unauthorized hospital management access.")

    update_fields: Dict[str, Any] = {
        "bed_capacity.general_available": max(0, request.general_available),
        "bed_capacity.icu_available": max(0, request.icu_available),
        "bed_capacity.emergency_available": max(0, request.emergency_available),
        "bed_capacity.total": max(0, request.general_available + request.icu_available + request.emergency_available),
        "emergency_24_7": request.emergency_24_7,
        "last_updated": time.time()
    }

    if request.departments:
        update_fields["departments"] = request.departments
    if request.services:
        update_fields["services"] = request.services
    if request.operating_hours:
        update_fields["operating_hours"] = request.operating_hours
    if request.phone:
        update_fields["phone"] = request.phone

    await healthcare_facilities_collection.update_one(
        {"_id": facility["_id"]},
        {"$set": update_fields}
    )

    updated_fac = await healthcare_facilities_collection.find_one({"_id": facility["_id"]}, {"_id": 0})
    return {"message": "Hospital availability matrix synchronized successfully.", "facility": updated_fac}

@router.post("/book-slot")
async def book_hospital_slot(
    request: BookHospitalSlotRequest,
    current_user: dict = Depends(get_current_user)
):
    """Patient books an OPD slot or emergency admission at a healthcare facility."""
    facility = await healthcare_facilities_collection.find_one({"facility_id": request.facility_id})
    if not facility:
        raise HTTPException(status_code=404, detail="Healthcare facility not found.")

    booking_id = f"HOSPBK-{uuid.uuid4().hex[:8].upper()}"
    patient_email = current_user["sub"]
    patient_name = request.patient_name or current_user.get("name", "Patient")

    # Helper to get bed counts
    def get_beds(fac):
        cap = fac.get("bed_capacity") or {}
        gen = cap.get("general_available") if cap.get("general_available") is not None else fac.get("available_beds", 25)
        icu = cap.get("icu_available") if cap.get("icu_available") is not None else fac.get("icu_beds_available", 5)
        emg = cap.get("emergency_available") if cap.get("emergency_available") is not None else fac.get("emergency_beds", 4)
        return gen, icu, emg

    gen_beds, icu_beds, emg_beds = get_beds(facility)

    # If Emergency Bed Admission or ICU Reservation requested, check and reserve
    bed_type = "general"
    if "emergency" in request.booking_type.lower():
        bed_type = "emergency"
        if emg_beds <= 0:
            raise HTTPException(status_code=400, detail="No emergency beds currently available at this facility.")
        await healthcare_facilities_collection.update_one(
            {"facility_id": request.facility_id},
            {"$inc": {"bed_capacity.emergency_available": -1, "emergency_beds": -1, "available_beds": -1}}
        )
    elif "icu" in request.booking_type.lower():
        bed_type = "icu"
        if icu_beds <= 0:
            raise HTTPException(status_code=400, detail="No ICU beds currently available at this facility.")
        await healthcare_facilities_collection.update_one(
            {"facility_id": request.facility_id},
            {"$inc": {"bed_capacity.icu_available": -1, "icu_beds_available": -1, "available_beds": -1}}
        )
    else:
        # General OPD / Slot booking
        await healthcare_facilities_collection.update_one(
            {"facility_id": request.facility_id},
            {"$inc": {"bed_capacity.general_available": -1, "available_beds": -1}}
        )


    booking_doc = {
        "booking_id": booking_id,
        "facility_id": request.facility_id,
        "facility_name": facility["name"],
        "facility_address": facility.get("address", ""),
        "facility_phone": facility.get("phone", ""),
        "patient_email": patient_email,
        "patient_name": patient_name,
        "patient_phone": request.patient_phone or "",
        "patient_age": request.patient_age,
        "patient_gender": request.patient_gender,
        "booking_type": request.booking_type,
        "department": request.department,
        "preferred_date": request.preferred_date,
        "preferred_time": request.preferred_time,
        "medical_reason": request.medical_reason,
        "urgency": request.urgency,
        "reserved_bed_type": bed_type,
        "status": "PENDING", # PENDING, APPROVED, ADMITTED, DISCHARGED, REJECTED
        "created_at": time.time()
    }

    await hospital_bookings_collection.insert_one(booking_doc)

    # In-app notification for hospital
    await notifications_collection.insert_one({
        "recipient_email": facility.get("admin_email", ""),
        "recipient_role": "hospital",
        "facility_id": request.facility_id,
        "title": f"New {request.booking_type} Request",
        "message": f"Patient {patient_name} requested a {request.booking_type} for {request.preferred_date} in {request.department}.",
        "booking_id": booking_id,
        "timestamp": time.time(),
        "read": False
    })

    booking_doc.pop("_id", None)
    return {
        "message": "Hospital booking requested successfully.",
        "booking": booking_doc
    }

@router.get("/bookings/list")
async def get_hospital_bookings(
    current_user: dict = Depends(get_current_user)
):
    """Retrieve hospital bookings based on caller role (Hospital admin or Patient)."""
    email = current_user["sub"]
    role = current_user.get("role", "patient")

    if role == "hospital":
        # Hospital sees incoming bookings for their facility
        fac = await healthcare_facilities_collection.find_one({"admin_email": email})
        fac_id = fac["facility_id"] if fac else current_user.get("facility_id")
        cursor = hospital_bookings_collection.find({"facility_id": fac_id}, {"_id": 0}).sort("created_at", -1)
    else:
        # Patient sees their own bookings
        cursor = hospital_bookings_collection.find({"patient_email": email}, {"_id": 0}).sort("created_at", -1)

    bookings = []
    async for b in cursor:
        bookings.append(b)
    return bookings

@router.put("/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    request: UpdateBookingStatusRequest,
    current_user: dict = Depends(get_current_user)
):
    """Hospital administrator updates the status of a patient booking / admission."""
    booking = await hospital_bookings_collection.find_one({"booking_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking request not found.")

    old_status = booking.get("status")
    new_status = request.status

    update_doc: Dict[str, Any] = {
        "status": new_status,
        "hospital_notes": request.notes,
        "last_updated": time.time()
    }
    if request.allocated_bed_number:
        update_doc["allocated_bed_number"] = request.allocated_bed_number

    # If rejecting or discharging, release reserved bed back to inventory
    if new_status in ["REJECTED", "DISCHARGED", "CANCELLED"] and old_status in ["PENDING", "APPROVED", "ADMITTED"]:
        bed_type = booking.get("reserved_bed_type")
        if bed_type == "emergency":
            await healthcare_facilities_collection.update_one(
                {"facility_id": booking["facility_id"]},
                {"$inc": {"bed_capacity.emergency_available": 1}}
            )
        elif bed_type == "icu":
            await healthcare_facilities_collection.update_one(
                {"facility_id": booking["facility_id"]},
                {"$inc": {"bed_capacity.icu_available": 1}}
            )

    await hospital_bookings_collection.update_one(
        {"booking_id": booking_id},
        {"$set": update_doc}
    )

    # In-app notification for patient
    await notifications_collection.insert_one({
        "recipient_email": booking["patient_email"],
        "recipient_role": "patient",
        "title": f"Hospital Request Updated: {new_status}",
        "message": f"Your request at {booking['facility_name']} is now {new_status}." + (f" Note: {request.notes}" if request.notes else ""),
        "booking_id": booking_id,
        "timestamp": time.time(),
        "read": False
    })

    return {"message": f"Booking status updated to {new_status}.", "booking_id": booking_id}
