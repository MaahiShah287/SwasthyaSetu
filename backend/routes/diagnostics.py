from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time
import uuid
from utils.jwt_handler import get_current_user
from database import (
    db,
    healthcare_facilities_collection,
    diagnostic_services_collection,
    diagnostic_recommendations_collection,
    notifications_collection,
    doctors_collection,
    users_collection,
)
from services.facility_service import haversine_distance, DEFAULT_LAT, DEFAULT_LON

router = APIRouter()

# ---------------------------------------------------------------------------
# Default seeded diagnostic services (mirroring medicine inventory seed pattern)
# ---------------------------------------------------------------------------

COMMON_DIAGNOSTIC_TESTS = [
    {"service_name": "Complete Blood Count (CBC)", "category": "Pathology"},
    {"service_name": "Blood Glucose (Fasting/PP)", "category": "Pathology"},
    {"service_name": "Lipid Profile", "category": "Pathology"},
    {"service_name": "Liver Function Test (LFT)", "category": "Pathology"},
    {"service_name": "Kidney Function Test (KFT)", "category": "Pathology"},
    {"service_name": "Thyroid Profile (T3/T4/TSH)", "category": "Pathology"},
    {"service_name": "Urine Routine Examination", "category": "Pathology"},
    {"service_name": "HbA1c", "category": "Pathology"},
    {"service_name": "Malaria Test (RDT/Smear)", "category": "Pathology"},
    {"service_name": "Dengue NS1 / IgM / IgG", "category": "Pathology"},
    {"service_name": "X-Ray (Chest / Bone)", "category": "Radiology"},
    {"service_name": "Ultrasound (Abdomen/Pelvis)", "category": "Radiology"},
    {"service_name": "CT Scan", "category": "Radiology"},
    {"service_name": "MRI", "category": "Radiology"},
    {"service_name": "Echocardiography (ECHO)", "category": "Cardiology"},
    {"service_name": "ECG (Electrocardiogram)", "category": "Cardiology"},
    {"service_name": "Stress Test (TMT)", "category": "Cardiology"},
    {"service_name": "Spirometry (Lung Function)", "category": "Pulmonology"},
    {"service_name": "Endoscopy (Upper GI)", "category": "Gastroenterology"},
    {"service_name": "Eye Examination (Retinoscopy)", "category": "Ophthalmology"},
]

SEED_FACILITY_SERVICES: Dict[str, List[Dict]] = {
    "FAC-001": [
        {"service_name": "Complete Blood Count (CBC)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 19:00", "price_inr": "₹120"},
        {"service_name": "X-Ray (Chest / Bone)", "category": "Radiology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 20:00", "price_inr": "₹200"},
        {"service_name": "CT Scan", "category": "Radiology", "availability": "AVAILABLE", "appointment_required": True, "operating_hours": "09:00 - 17:00", "price_inr": "₹2500"},
        {"service_name": "ECG (Electrocardiogram)", "category": "Cardiology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 20:00", "price_inr": "₹150"},
        {"service_name": "Ultrasound (Abdomen/Pelvis)", "category": "Radiology", "availability": "AVAILABLE", "appointment_required": True, "operating_hours": "09:00 - 17:00", "price_inr": "₹500"},
        {"service_name": "MRI", "category": "Radiology", "availability": "LIMITED", "appointment_required": True, "operating_hours": "10:00 - 16:00", "price_inr": "₹4500"},
        {"service_name": "Blood Glucose (Fasting/PP)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 19:00", "price_inr": "₹60"},
        {"service_name": "Lipid Profile", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 19:00", "price_inr": "₹350"},
    ],
    "FAC-002": [
        {"service_name": "Complete Blood Count (CBC)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 16:00", "price_inr": "₹80 (Govt)"},
        {"service_name": "Blood Glucose (Fasting/PP)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 14:00", "price_inr": "₹40 (Govt)"},
        {"service_name": "Urine Routine Examination", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 14:00", "price_inr": "₹30 (Govt)"},
        {"service_name": "X-Ray (Chest / Bone)", "category": "Radiology", "availability": "LIMITED", "appointment_required": True, "operating_hours": "09:00 - 13:00", "price_inr": "₹100 (Govt)"},
        {"service_name": "Malaria Test (RDT/Smear)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 16:00", "price_inr": "Free"},
        {"service_name": "ECG (Electrocardiogram)", "category": "Cardiology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "09:00 - 14:00", "price_inr": "₹80 (Govt)"},
    ],
    "FAC-003": [
        {"service_name": "Complete Blood Count (CBC)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 14:00", "price_inr": "₹60 (Govt)"},
        {"service_name": "Blood Glucose (Fasting/PP)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 14:00", "price_inr": "Free"},
        {"service_name": "Malaria Test (RDT/Smear)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 14:00", "price_inr": "Free"},
        {"service_name": "Dengue NS1 / IgM / IgG", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 14:00", "price_inr": "Free"},
        {"service_name": "Urine Routine Examination", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 14:00", "price_inr": "Free"},
    ],
    "FAC-006": [
        {"service_name": "Complete Blood Count (CBC)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 21:00", "price_inr": "₹150"},
        {"service_name": "Lipid Profile", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 21:00", "price_inr": "₹400"},
        {"service_name": "Liver Function Test (LFT)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 21:00", "price_inr": "₹500"},
        {"service_name": "Kidney Function Test (KFT)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 21:00", "price_inr": "₹450"},
        {"service_name": "Thyroid Profile (T3/T4/TSH)", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 21:00", "price_inr": "₹600"},
        {"service_name": "HbA1c", "category": "Pathology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "07:00 - 21:00", "price_inr": "₹350"},
        {"service_name": "X-Ray (Chest / Bone)", "category": "Radiology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 20:00", "price_inr": "₹250"},
        {"service_name": "Ultrasound (Abdomen/Pelvis)", "category": "Radiology", "availability": "AVAILABLE", "appointment_required": True, "operating_hours": "09:00 - 19:00", "price_inr": "₹700"},
        {"service_name": "CT Scan", "category": "Radiology", "availability": "LIMITED", "appointment_required": True, "operating_hours": "10:00 - 18:00", "price_inr": "₹3000"},
        {"service_name": "ECG (Electrocardiogram)", "category": "Cardiology", "availability": "AVAILABLE", "appointment_required": False, "operating_hours": "08:00 - 20:00", "price_inr": "₹200"},
    ],
}


async def ensure_diagnostic_services_seeded():
    """Seed diagnostic services for demo facilities if none exist."""
    count = await diagnostic_services_collection.count_documents({})
    if count > 0:
        return
    docs = []
    for fac_id, services in SEED_FACILITY_SERVICES.items():
        for svc in services:
            docs.append({
                "service_id": f"DIAG-{uuid.uuid4().hex[:8].upper()}",
                "facility_id": fac_id,
                "service_name": svc["service_name"],
                "category": svc.get("category", "General"),
                "availability": svc.get("availability", "AVAILABLE"),
                "appointment_required": svc.get("appointment_required", False),
                "operating_hours": svc.get("operating_hours", "09:00 - 17:00"),
                "price_inr": svc.get("price_inr", "N/A"),
                "notes": "",
                "last_updated": time.time(),
            })
    if docs:
        try:
            await diagnostic_services_collection.insert_many(docs, ordered=False)
            print(f"[diagnostics] Seeded {len(docs)} diagnostic service records.")
        except Exception as e:
            print(f"[diagnostics] Seed note: {e}")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def format_ts(ts: float) -> str:
    diff = time.time() - ts
    if diff < 60:
        return "Just now"
    elif diff < 3600:
        return f"{int(diff/60)} min ago"
    elif diff < 86400:
        return f"{int(diff/3600)} hr ago"
    elif diff < 172800:
        return "Yesterday"
    else:
        return f"{int(diff/86400)} days ago"


async def get_facility_for_admin(current_user: dict):
    """Resolve facility for hospital admin from JWT email."""
    email = current_user["sub"]
    facility = await healthcare_facilities_collection.find_one({"admin_email": email}, {"_id": 0})
    if not facility:
        fac_id = current_user.get("facility_id")
        if fac_id:
            facility = await healthcare_facilities_collection.find_one({"facility_id": fac_id}, {"_id": 0})
    return facility


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class AddDiagnosticServiceRequest(BaseModel):
    facility_id: Optional[str] = None  # optional; resolved from JWT if omitted
    service_name: str = Field(..., min_length=1)
    category: Optional[str] = "General"
    availability: str = "AVAILABLE"  # AVAILABLE | LIMITED | UNAVAILABLE
    appointment_required: bool = False
    operating_hours: Optional[str] = "09:00 - 17:00"
    price_inr: Optional[str] = "N/A"
    notes: Optional[str] = ""


class UpdateDiagnosticServiceRequest(BaseModel):
    availability: Optional[str] = None
    appointment_required: Optional[bool] = None
    operating_hours: Optional[str] = None
    price_inr: Optional[str] = None
    notes: Optional[str] = None


class CreateRecommendationRequest(BaseModel):
    patient_email: str = Field(..., min_length=1)
    service_name: str = Field(..., min_length=1)
    category: Optional[str] = "General"
    reason: str = Field(..., min_length=1)
    priority: str = "Routine"  # Routine | Urgent | Emergency
    instructions: Optional[str] = ""
    notes: Optional[str] = ""
    consultation_id: Optional[str] = None
    appointment_id: Optional[str] = None


class UpdateRecommendationStatusRequest(BaseModel):
    status: str  # PENDING | SCHEDULED | COMPLETED | CANCELLED
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# PUBLIC / PATIENT — Search & Availability
# ---------------------------------------------------------------------------

@router.get("/search")
async def search_diagnostic_tests(
    query: str = Query("", min_length=0),
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Autocomplete search for diagnostic test names."""
    match_filter: Dict[str, Any] = {}
    if query:
        match_filter["service_name"] = {"$regex": query, "$options": "i"}
    if category:
        match_filter["category"] = {"$regex": category, "$options": "i"}

    # Distinct test names that match query
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$service_name",
            "category": {"$first": "$category"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    cursor = diagnostic_services_collection.aggregate(pipeline)
    suggestions = []
    async for doc in cursor:
        suggestions.append({
            "service_name": doc["_id"],
            "category": doc.get("category", "General"),
            "facility_count": doc.get("count", 0)
        })

    # Also include common tests if not many results
    if len(suggestions) < 5 and query:
        for t in COMMON_DIAGNOSTIC_TESTS:
            if query.lower() in t["service_name"].lower():
                if not any(s["service_name"] == t["service_name"] for s in suggestions):
                    suggestions.append({"service_name": t["service_name"], "category": t["category"], "facility_count": 0})

    return {"query": query, "suggestions": suggestions[:20]}


@router.get("/availability")
async def get_diagnostic_availability(
    query: str = Query(..., description="Diagnostic test name"),
    status: Optional[str] = None,
    category: Optional[str] = None,
    facility_type: Optional[str] = None,
    city: Optional[str] = None,
    user_lat: Optional[float] = Query(DEFAULT_LAT),
    user_lon: Optional[float] = Query(DEFAULT_LON),
    current_user: dict = Depends(get_current_user)
):
    """Find nearby facilities providing a specific diagnostic service."""
    lat = user_lat or DEFAULT_LAT
    lon = user_lon or DEFAULT_LON

    svc_filter: Dict[str, Any] = {
        "service_name": {"$regex": query, "$options": "i"}
    }
    if status and status != "ALL":
        svc_filter["availability"] = status

    cursor = diagnostic_services_collection.find(svc_filter, {"_id": 0})
    service_records = []
    async for s in cursor:
        service_records.append(s)

    if not service_records:
        return {
            "query": query,
            "total_results": 0,
            "available_count": 0,
            "limited_count": 0,
            "unavailable_count": 0,
            "user_coordinates": {"latitude": lat, "longitude": lon},
            "results": []
        }

    # Fetch all referenced facilities in one query
    fac_ids = list({s["facility_id"] for s in service_records})
    fac_filter: Dict[str, Any] = {"facility_id": {"$in": fac_ids}}
    if city and city.lower() != "all":
        fac_filter["$or"] = [
            {"city": {"$regex": city, "$options": "i"}},
            {"district": {"$regex": city, "$options": "i"}},
        ]
    if facility_type and facility_type.lower() not in ("all", ""):
        fac_filter["facility_type"] = {"$regex": facility_type, "$options": "i"}

    fac_cursor = healthcare_facilities_collection.find(fac_filter, {"_id": 0})
    facilities_map: Dict[str, Any] = {}
    async for f in fac_cursor:
        facilities_map[f["facility_id"]] = f

    results = []
    for svc in service_records:
        fac = facilities_map.get(svc["facility_id"])
        if not fac:
            continue
        fac_lat = fac.get("latitude", DEFAULT_LAT)
        fac_lon = fac.get("longitude", DEFAULT_LON)
        dist = haversine_distance(lat, lon, fac_lat, fac_lon)

        results.append({
            "service_id": svc.get("service_id", ""),
            "service_name": svc.get("service_name", ""),
            "category": svc.get("category", "General"),
            "availability": svc.get("availability", "UNAVAILABLE"),
            "appointment_required": svc.get("appointment_required", False),
            "operating_hours": svc.get("operating_hours", ""),
            "price_inr": svc.get("price_inr", "N/A"),
            "notes": svc.get("notes", ""),
            "last_updated": svc.get("last_updated", time.time()),
            "last_updated_text": format_ts(svc.get("last_updated", time.time())),
            "distance_km": round(dist, 2),
            "facility": {
                "facility_id": fac.get("facility_id", ""),
                "name": fac.get("name", ""),
                "type": fac.get("type", ""),
                "category": fac.get("category", ""),
                "facility_type": fac.get("facility_type", ""),
                "address": fac.get("address", ""),
                "city": fac.get("city", fac.get("district", "")),
                "district": fac.get("district", ""),
                "phone": fac.get("phone", ""),
                "emergency_phone": fac.get("emergency_phone", "108"),
                "operating_hours": fac.get("operating_hours", ""),
                "latitude": fac_lat,
                "longitude": fac_lon,
                "distance_km": round(dist, 2),
                "directions_url": f"https://www.google.com/maps/dir/?api=1&destination={fac_lat},{fac_lon}",
            }
        })

    results.sort(key=lambda x: x["distance_km"])

    avail_count = sum(1 for r in results if r["availability"] == "AVAILABLE")
    limited_count = sum(1 for r in results if r["availability"] == "LIMITED")
    unavail_count = sum(1 for r in results if r["availability"] == "UNAVAILABLE")

    return {
        "query": query,
        "total_results": len(results),
        "available_count": avail_count,
        "limited_count": limited_count,
        "unavailable_count": unavail_count,
        "user_coordinates": {"latitude": lat, "longitude": lon},
        "results": results,
    }


# ---------------------------------------------------------------------------
# PATIENT — Recommendations
# ---------------------------------------------------------------------------

@router.get("/recommendations")
async def get_my_recommendations(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Patient views their own diagnostic recommendations (JWT-gated)."""
    patient_email = current_user["sub"]
    q: Dict[str, Any] = {"patient_email": patient_email}
    if status and status != "ALL":
        q["status"] = status

    cursor = diagnostic_recommendations_collection.find(q, {"_id": 0}).sort("created_at", -1)
    recs = []
    async for r in cursor:
        r["created_at_text"] = format_ts(r.get("created_at", time.time()))
        recs.append(r)
    return recs


# ---------------------------------------------------------------------------
# DOCTOR — Create & Track Recommendations
# ---------------------------------------------------------------------------

@router.post("/recommendations")
async def create_recommendation(
    request: CreateRecommendationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Doctor creates a diagnostic recommendation for a patient."""
    role = current_user.get("role", "")
    if role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Only doctors can create diagnostic recommendations.")

    doctor_email = current_user["sub"]
    doctor_doc = await doctors_collection.find_one({"email": doctor_email}, {"_id": 0})
    doctor_id = doctor_doc["doctor_id"] if doctor_doc else f"DOC-{doctor_email}"
    doctor_name = doctor_doc["name"] if doctor_doc else current_user.get("name", "Doctor")

    # Verify patient exists
    patient = await users_collection.find_one({"email": request.patient_email})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found with the provided email.")

    rec_id = f"DIAG-REC-{uuid.uuid4().hex[:8].upper()}"
    now = time.time()

    doc = {
        "recommendation_id": rec_id,
        "patient_email": request.patient_email,
        "patient_name": patient.get("name", request.patient_email),
        "doctor_id": doctor_id,
        "doctor_name": doctor_name,
        "doctor_email": doctor_email,
        "consultation_id": request.consultation_id,
        "appointment_id": request.appointment_id,
        "service_name": request.service_name,
        "category": request.category,
        "reason": request.reason,
        "priority": request.priority,
        "instructions": request.instructions or "",
        "notes": request.notes or "",
        "status": "PENDING",
        "created_at": now,
        "updated_at": now,
    }

    await diagnostic_recommendations_collection.insert_one(doc)

    # Notify the patient
    await notifications_collection.insert_one({
        "recipient_email": request.patient_email,
        "recipient_role": "patient",
        "title": f"New Diagnostic Recommendation: {request.service_name}",
        "message": f"Dr. {doctor_name} has recommended a {request.service_name} ({request.priority} priority). Reason: {request.reason}",
        "recommendation_id": rec_id,
        "timestamp": now,
        "read": False,
    })

    doc.pop("_id", None)
    return {"message": "Diagnostic recommendation created successfully.", "recommendation": doc}


@router.get("/recommendations/by-doctor")
async def get_doctor_recommendations(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Doctor views all recommendations they have issued."""
    role = current_user.get("role", "")
    if role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint.")

    doctor_email = current_user["sub"]
    doctor_doc = await doctors_collection.find_one({"email": doctor_email})
    doctor_id = doctor_doc["doctor_id"] if doctor_doc else f"DOC-{doctor_email}"

    q: Dict[str, Any] = {"$or": [{"doctor_id": doctor_id}, {"doctor_email": doctor_email}]}
    if status and status != "ALL":
        q["status"] = status

    cursor = diagnostic_recommendations_collection.find(q, {"_id": 0}).sort("created_at", -1)
    recs = []
    async for r in cursor:
        r["created_at_text"] = format_ts(r.get("created_at", time.time()))
        recs.append(r)
    return recs


@router.put("/recommendations/{recommendation_id}/status")
async def update_recommendation_status(
    recommendation_id: str,
    request: UpdateRecommendationStatusRequest,
    current_user: dict = Depends(get_current_user)
):
    """Doctor or patient updates recommendation status."""
    rec = await diagnostic_recommendations_collection.find_one({"recommendation_id": recommendation_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found.")

    role = current_user.get("role", "patient")
    email = current_user["sub"]

    # RBAC: patient can only update their own; doctor can update their issued ones
    if role == "patient" and rec["patient_email"] != email:
        raise HTTPException(status_code=403, detail="Access denied.")
    if role == "doctor" and rec["doctor_email"] != email:
        raise HTTPException(status_code=403, detail="Access denied.")

    valid_statuses = {"PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"}
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    update: Dict[str, Any] = {
        "status": request.status,
        "updated_at": time.time(),
    }
    if request.notes:
        update["status_notes"] = request.notes

    await diagnostic_recommendations_collection.update_one(
        {"recommendation_id": recommendation_id},
        {"$set": update}
    )
    return {"message": f"Recommendation status updated to {request.status}.", "recommendation_id": recommendation_id}


# ---------------------------------------------------------------------------
# HOSPITAL — Manage Diagnostic Services
# ---------------------------------------------------------------------------

@router.get("/services/facility")
async def get_facility_diagnostic_services(
    search: Optional[str] = None,
    availability: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Hospital admin views/manages their facility's diagnostic services."""
    role = current_user.get("role", "")
    if role not in ("hospital", "admin"):
        raise HTTPException(status_code=403, detail="Only hospital staff can access facility diagnostic services.")

    facility = await get_facility_for_admin(current_user)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found for this account.")

    fac_id = facility["facility_id"]
    q: Dict[str, Any] = {"facility_id": fac_id}
    if search:
        q["service_name"] = {"$regex": search, "$options": "i"}
    if availability and availability != "ALL":
        q["availability"] = availability
    if category and category != "ALL":
        q["category"] = {"$regex": category, "$options": "i"}

    cursor = diagnostic_services_collection.find(q, {"_id": 0}).sort("service_name", 1)
    services = []
    async for s in cursor:
        s["last_updated_text"] = format_ts(s.get("last_updated", time.time()))
        services.append(s)

    total = len(services)
    avail = sum(1 for s in services if s["availability"] == "AVAILABLE")
    limited = sum(1 for s in services if s["availability"] == "LIMITED")
    unavail = sum(1 for s in services if s["availability"] == "UNAVAILABLE")

    return {
        "facility": {"facility_id": fac_id, "name": facility.get("name", "")},
        "stats": {"total": total, "available": avail, "limited": limited, "unavailable": unavail},
        "services": services,
    }


@router.post("/services")
async def add_diagnostic_service(
    request: AddDiagnosticServiceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Hospital admin adds a diagnostic service to their facility."""
    role = current_user.get("role", "")
    if role not in ("hospital", "admin"):
        raise HTTPException(status_code=403, detail="Only hospital staff can manage diagnostic services.")

    facility = await get_facility_for_admin(current_user)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found for this account.")

    fac_id = facility["facility_id"]

    # Prevent duplicates
    existing = await diagnostic_services_collection.find_one({
        "facility_id": fac_id,
        "service_name": {"$regex": f"^{request.service_name}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=409, detail=f"'{request.service_name}' already exists for this facility. Update the existing entry instead.")

    service_id = f"DIAG-{uuid.uuid4().hex[:8].upper()}"
    doc = {
        "service_id": service_id,
        "facility_id": fac_id,
        "facility_name": facility.get("name", ""),
        "service_name": request.service_name,
        "category": request.category or "General",
        "availability": request.availability,
        "appointment_required": request.appointment_required,
        "operating_hours": request.operating_hours or "09:00 - 17:00",
        "price_inr": request.price_inr or "N/A",
        "notes": request.notes or "",
        "last_updated": time.time(),
    }
    await diagnostic_services_collection.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Diagnostic service added successfully.", "service": doc}


@router.put("/services/{service_id}")
async def update_diagnostic_service(
    service_id: str,
    request: UpdateDiagnosticServiceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Hospital admin updates a diagnostic service."""
    role = current_user.get("role", "")
    if role not in ("hospital", "admin"):
        raise HTTPException(status_code=403, detail="Only hospital staff can manage diagnostic services.")

    facility = await get_facility_for_admin(current_user)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found for this account.")

    svc = await diagnostic_services_collection.find_one({"service_id": service_id})
    if not svc:
        raise HTTPException(status_code=404, detail="Diagnostic service not found.")

    # Ownership check — hospital can only update its own services
    if svc["facility_id"] != facility["facility_id"]:
        raise HTTPException(status_code=403, detail="Cannot modify services of another facility.")

    update: Dict[str, Any] = {"last_updated": time.time()}
    if request.availability is not None:
        update["availability"] = request.availability
    if request.appointment_required is not None:
        update["appointment_required"] = request.appointment_required
    if request.operating_hours is not None:
        update["operating_hours"] = request.operating_hours
    if request.price_inr is not None:
        update["price_inr"] = request.price_inr
    if request.notes is not None:
        update["notes"] = request.notes

    await diagnostic_services_collection.update_one(
        {"service_id": service_id}, {"$set": update}
    )
    updated = await diagnostic_services_collection.find_one({"service_id": service_id}, {"_id": 0})
    if updated:
        updated["last_updated_text"] = format_ts(updated.get("last_updated", time.time()))
    return {"message": "Diagnostic service updated.", "service": updated}


@router.delete("/services/{service_id}")
async def delete_diagnostic_service(
    service_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Hospital admin removes a diagnostic service from their facility."""
    role = current_user.get("role", "")
    if role not in ("hospital", "admin"):
        raise HTTPException(status_code=403, detail="Only hospital staff can manage diagnostic services.")

    facility = await get_facility_for_admin(current_user)
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found for this account.")

    svc = await diagnostic_services_collection.find_one({"service_id": service_id})
    if not svc:
        raise HTTPException(status_code=404, detail="Diagnostic service not found.")
    if svc["facility_id"] != facility["facility_id"]:
        raise HTTPException(status_code=403, detail="Cannot delete services of another facility.")

    await diagnostic_services_collection.delete_one({"service_id": service_id})
    return {"message": "Diagnostic service removed.", "service_id": service_id}
