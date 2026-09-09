"""
ASHA/ANM Community Health Worker Module - Backend Routes
Reuses existing collections: profiles, vaccinations, follow_ups, referrals_history, notifications
New collections: community_visits, health_case_reports
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, date
import uuid
import time

from database import (
    profile_collection,
    users_collection,
    vaccinations_collection,
    follow_ups_collection,
    referrals_history_collection,
    notifications_collection,
    asha_visits_collection,
    asha_case_reports_collection,
)
from utils.jwt_handler import get_current_user

router = APIRouter()

# ─────────────────────────────────────────────
# RBAC helper
# ─────────────────────────────────────────────
ALLOWED_ROLES = {"asha_anm", "admin", "doctor"}

def require_asha_role(current_user: dict = Depends(get_current_user)):
    role = current_user.get("role", "patient")
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Access restricted to ASHA/ANM field workers.")
    return current_user


# ─────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────

class PatientSearchResult(BaseModel):
    email: str
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    blood_group: Optional[str] = None
    village: Optional[str] = None

class RegisterPatientRequest(BaseModel):
    name: str
    phone: str
    age: int
    gender: str
    village: str
    district: Optional[str] = None
    blood_group: Optional[str] = "Not Set"
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None

class HomeVisitRequest(BaseModel):
    patient_email: str
    patient_name: str
    visit_date: str           # ISO date string
    visit_type: str           # routine, antenatal, postnatal, sick, vaccination, follow_up
    chief_complaint: Optional[str] = None
    vital_signs: Optional[dict] = None   # {bp, pulse, temp, weight, height, spo2}
    observations: Optional[str] = None
    services_provided: Optional[List[str]] = []
    medicines_dispensed: Optional[List[str]] = []
    referral_needed: bool = False
    referral_reason: Optional[str] = None
    next_visit_date: Optional[str] = None
    notes: Optional[str] = None
    offline_id: Optional[str] = None

class UpdateVisitRequest(BaseModel):
    observations: Optional[str] = None
    vital_signs: Optional[dict] = None
    services_provided: Optional[List[str]] = None
    medicines_dispensed: Optional[List[str]] = None
    referral_needed: Optional[bool] = None
    referral_reason: Optional[str] = None
    next_visit_date: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None   # pending, completed, cancelled

class CaseReportRequest(BaseModel):
    patient_email: str
    patient_name: str
    report_date: str
    disease_suspected: str
    symptoms: List[str]
    severity: str           # mild, moderate, severe, critical
    action_taken: str
    referred_to: Optional[str] = None
    referred_facility: Optional[str] = None
    notes: Optional[str] = None
    offline_id: Optional[str] = None

class FollowUpNoteRequest(BaseModel):
    patient_email: str
    patient_name: str
    note: str
    priority: str = "medium"  # low, medium, high, urgent
    due_date: Optional[str] = None
    follow_up_type: str = "asha_visit"
    offline_id: Optional[str] = None

class ReferralDraftRequest(BaseModel):
    patient_email: str
    patient_name: str
    reason: str
    urgency: str = "routine"   # routine, urgent, emergency
    referred_to_facility: Optional[str] = None
    referred_to_doctor: Optional[str] = None
    notes: Optional[str] = None
    offline_id: Optional[str] = None

class VaccinationObservationRequest(BaseModel):
    patient_email: str
    patient_name: str
    vaccine_name: str
    administered_date: str
    dose_number: int = 1
    batch_number: Optional[str] = None
    administered_by: Optional[str] = None
    site: Optional[str] = None   # left arm, right arm, etc.
    adverse_reaction: Optional[str] = None
    notes: Optional[str] = None
    offline_id: Optional[str] = None


# ─────────────────────────────────────────────
# DASHBOARD SUMMARY
# ─────────────────────────────────────────────

@router.get("/dashboard")
async def get_asha_dashboard(current_user: dict = Depends(require_asha_role)):
    worker_email = current_user["sub"]
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Stats: visits
    total_registered = await profile_collection.count_documents({"registered_by_asha": worker_email})
    today_visits = await asha_visits_collection.count_documents({
        "worker_email": worker_email,
        "created_at": {"$gte": today.timestamp()}
    })
    pending_followups = await follow_ups_collection.count_documents({
        "created_by": worker_email,
        "status": {"$in": ["scheduled", "pending"]}
    })
    active_referrals = await referrals_history_collection.count_documents({
        "referred_by": worker_email,
        "status": {"$in": ["pending", "accepted"]}
    })
    urgent_cases = await asha_case_reports_collection.count_documents({
        "worker_email": worker_email,
        "severity": {"$in": ["severe", "critical"]},
        "status": {"$ne": "resolved"}
    })

    # Recent patients registered by this worker
    recent_cursor = profile_collection.find(
        {"registered_by_asha": worker_email},
        {"_id": 0, "email": 1, "name": 1, "age": 1, "gender": 1, "village": 1, "phone": 1}
    ).sort("created_at", -1).limit(5)
    recent_patients = await recent_cursor.to_list(length=5)

    # Today's visits
    visits_cursor = asha_visits_collection.find(
        {"worker_email": worker_email, "created_at": {"$gte": today.timestamp()}},
        {"_id": 0}
    ).sort("created_at", -1).limit(10)
    todays_visits = await visits_cursor.to_list(length=10)

    return {
        "stats": {
            "total_registered_patients": total_registered,
            "todays_visits": today_visits,
            "pending_followups": pending_followups,
            "active_referrals": active_referrals,
            "urgent_cases": urgent_cases,
        },
        "recent_patients": recent_patients,
        "todays_visits": todays_visits,
        "worker_name": current_user.get("name", "ASHA Worker"),
        "worker_email": worker_email,
    }


# ─────────────────────────────────────────────
# PATIENT MANAGEMENT
# ─────────────────────────────────────────────

@router.get("/patients/search")
async def search_patients(
    q: str = Query(..., min_length=2),
    current_user: dict = Depends(require_asha_role)
):
    """Search existing patients by name or phone (minimal data only)."""
    regex = {"$regex": q, "$options": "i"}
    cursor = profile_collection.find(
        {"$or": [{"name": regex}, {"phone": regex}, {"mobile": regex}]},
        {"_id": 0, "email": 1, "name": 1, "age": 1, "gender": 1,
         "phone": 1, "blood_group": 1, "village": 1}
    ).limit(20)
    results = await cursor.to_list(length=20)
    return {"patients": results, "count": len(results)}


@router.post("/patients/register")
async def register_patient_by_asha(
    request: RegisterPatientRequest,
    current_user: dict = Depends(require_asha_role)
):
    """Register a new patient in the field. Creates a profile record."""
    worker_email = current_user["sub"]
    worker_name = current_user.get("name", "ASHA Worker")
    
    # Generate a placeholder email-like ID for field-registered patients
    patient_id = f"field-{uuid.uuid4().hex[:8]}@asha.local"

    profile_doc = {
        "email": patient_id,
        "name": request.name,
        "phone": request.phone,
        "mobile": request.phone,
        "age": request.age,
        "gender": request.gender,
        "village": request.village,
        "district": request.district,
        "blood_group": request.blood_group or "Not Set",
        "emergency_contact": request.emergency_contact or "Not Set",
        "dob": "Not Set",
        "notes": request.notes,
        "role": "patient",
        "registered_by_asha": worker_email,
        "registered_by_name": worker_name,
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    await profile_collection.insert_one(profile_doc)

    return {
        "message": "Patient registered successfully.",
        "patient_id": patient_id,
        "patient_name": request.name
    }


@router.get("/patients/{patient_email}/profile")
async def get_patient_profile(
    patient_email: str,
    current_user: dict = Depends(require_asha_role)
):
    """Get minimal patient profile for ASHA view."""
    safe_email = patient_email.replace("%40", "@")
    profile = await profile_collection.find_one(
        {"email": safe_email},
        {"_id": 0, "email": 1, "name": 1, "age": 1, "gender": 1,
         "phone": 1, "blood_group": 1, "village": 1, "district": 1,
         "emergency_contact": 1, "dob": 1}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found.")
    
    # Vaccination summary (last 3)
    vac_cursor = vaccinations_collection.find(
        {"patient_id": safe_email},
        {"_id": 0, "vaccine_name": 1, "vaccination_date": 1, "next_due_date": 1, "status": 1}
    ).sort("vaccination_date", -1).limit(3)
    vaccinations = await vac_cursor.to_list(length=3)

    # Follow-up summary
    fu_cursor = follow_ups_collection.find(
        {"patient_id": safe_email, "status": {"$in": ["scheduled", "pending"]}},
        {"_id": 0, "follow_up_type": 1, "due_date": 1, "priority": 1, "notes": 1}
    ).sort("due_date", 1).limit(3)
    follow_ups = await fu_cursor.to_list(length=3)

    return {
        "profile": profile,
        "recent_vaccinations": vaccinations,
        "pending_followups": follow_ups
    }


# ─────────────────────────────────────────────
# HOME / COMMUNITY VISITS
# ─────────────────────────────────────────────

@router.post("/visits")
async def create_visit(
    request: HomeVisitRequest,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    worker_name = current_user.get("name", "ASHA Worker")
    visit_id = f"VISIT-{uuid.uuid4().hex[:8].upper()}"

    visit_doc = {
        "visit_id": visit_id,
        "worker_email": worker_email,
        "worker_name": worker_name,
        "patient_email": request.patient_email,
        "patient_name": request.patient_name,
        "visit_date": request.visit_date,
        "visit_type": request.visit_type,
        "chief_complaint": request.chief_complaint,
        "vital_signs": request.vital_signs or {},
        "observations": request.observations,
        "services_provided": request.services_provided or [],
        "medicines_dispensed": request.medicines_dispensed or [],
        "referral_needed": request.referral_needed,
        "referral_reason": request.referral_reason,
        "next_visit_date": request.next_visit_date,
        "notes": request.notes,
        "status": "completed",
        "offline_id": request.offline_id,
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    await asha_visits_collection.insert_one(visit_doc)

    # If referral needed, create a draft referral
    if request.referral_needed and request.referral_reason:
        ref_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
        ref_doc = {
            "referral_id": ref_id,
            "patient_email": request.patient_email,
            "patient_name": request.patient_name,
            "referred_by": worker_email,
            "referred_by_name": worker_name,
            "referred_by_role": "asha_anm",
            "reason": request.referral_reason,
            "urgency": "routine",
            "status": "pending",
            "source_visit_id": visit_id,
            "created_at": time.time(),
        }
        await referrals_history_collection.insert_one(ref_doc)

    return {"message": "Visit recorded successfully.", "visit_id": visit_id}


@router.get("/visits")
async def get_visits(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_email: Optional[str] = None,
    visit_type: Optional[str] = None,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    role = current_user.get("role", "asha_anm")

    # Admins and doctors see all; asha workers see their own
    query: dict = {}
    if role not in ("admin", "doctor"):
        query["worker_email"] = worker_email
    if patient_email:
        query["patient_email"] = patient_email
    if visit_type:
        query["visit_type"] = visit_type

    total = await asha_visits_collection.count_documents(query)
    cursor = asha_visits_collection.find(query, {"_id": 0}) \
        .sort("created_at", -1) \
        .skip((page - 1) * limit) \
        .limit(limit)
    visits = await cursor.to_list(length=limit)

    return {"visits": visits, "total": total, "page": page, "limit": limit}


@router.patch("/visits/{visit_id}")
async def update_visit(
    visit_id: str,
    request: UpdateVisitRequest,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    visit = await asha_visits_collection.find_one({"visit_id": visit_id})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    if visit["worker_email"] != worker_email and current_user.get("role") not in ("admin", "doctor"):
        raise HTTPException(status_code=403, detail="Cannot edit another worker's visit.")

    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = time.time()
    await asha_visits_collection.update_one({"visit_id": visit_id}, {"$set": update_data})
    return {"message": "Visit updated.", "visit_id": visit_id}


# ─────────────────────────────────────────────
# HEALTH CASE REPORTS
# ─────────────────────────────────────────────

@router.post("/case-reports")
async def create_case_report(
    request: CaseReportRequest,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    worker_name = current_user.get("name", "ASHA Worker")
    report_id = f"CASE-{uuid.uuid4().hex[:8].upper()}"

    report_doc = {
        "report_id": report_id,
        "worker_email": worker_email,
        "worker_name": worker_name,
        "patient_email": request.patient_email,
        "patient_name": request.patient_name,
        "report_date": request.report_date,
        "disease_suspected": request.disease_suspected,
        "symptoms": request.symptoms,
        "severity": request.severity,
        "action_taken": request.action_taken,
        "referred_to": request.referred_to,
        "referred_facility": request.referred_facility,
        "notes": request.notes,
        "status": "active",
        "offline_id": request.offline_id,
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    await asha_case_reports_collection.insert_one(report_doc)

    return {"message": "Case report submitted.", "report_id": report_id}


@router.get("/case-reports")
async def get_case_reports(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    severity: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    role = current_user.get("role", "asha_anm")

    query: dict = {}
    if role not in ("admin", "doctor"):
        query["worker_email"] = worker_email
    if severity:
        query["severity"] = severity
    if status:
        query["status"] = status

    total = await asha_case_reports_collection.count_documents(query)
    cursor = asha_case_reports_collection.find(query, {"_id": 0}) \
        .sort("created_at", -1) \
        .skip((page - 1) * limit) \
        .limit(limit)
    reports = await cursor.to_list(length=limit)

    return {"reports": reports, "total": total, "page": page, "limit": limit}


# ─────────────────────────────────────────────
# FOLLOW-UP NOTES (reuses existing follow_ups_collection)
# ─────────────────────────────────────────────

@router.post("/follow-up-notes")
async def create_follow_up_note(
    request: FollowUpNoteRequest,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    worker_name = current_user.get("name", "ASHA Worker")
    fu_id = f"FU-ASHA-{uuid.uuid4().hex[:8].upper()}"

    fu_doc = {
        "follow_up_id": fu_id,
        "patient_id": request.patient_email,
        "patient_name": request.patient_name,
        "follow_up_type": request.follow_up_type,
        "notes": request.note,
        "priority": request.priority,
        "due_date": request.due_date,
        "status": "scheduled",
        "created_by": worker_email,
        "created_by_name": worker_name,
        "created_by_role": "asha_anm",
        "offline_id": request.offline_id,
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    await follow_ups_collection.insert_one(fu_doc)

    return {"message": "Follow-up note created.", "follow_up_id": fu_id}


@router.get("/follow-up-notes")
async def get_asha_follow_ups(
    status: Optional[str] = None,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    query: dict = {"created_by": worker_email}
    if status:
        query["status"] = status

    cursor = follow_ups_collection.find(query, {"_id": 0}) \
        .sort("due_date", 1) \
        .limit(50)
    follow_ups = await cursor.to_list(length=50)
    return {"follow_ups": follow_ups, "count": len(follow_ups)}


# ─────────────────────────────────────────────
# REFERRAL DRAFTS (reuses referrals_history_collection)
# ─────────────────────────────────────────────

@router.post("/referrals")
async def create_referral_draft(
    request: ReferralDraftRequest,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    worker_name = current_user.get("name", "ASHA Worker")
    ref_id = f"REF-ASHA-{uuid.uuid4().hex[:8].upper()}"

    ref_doc = {
        "referral_id": ref_id,
        "patient_email": request.patient_email,
        "patient_name": request.patient_name,
        "referred_by": worker_email,
        "referred_by_name": worker_name,
        "referred_by_role": "asha_anm",
        "reason": request.reason,
        "urgency": request.urgency,
        "referred_to_facility": request.referred_to_facility,
        "referred_to_doctor": request.referred_to_doctor,
        "notes": request.notes,
        "status": "pending",
        "offline_id": request.offline_id,
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    await referrals_history_collection.insert_one(ref_doc)
    return {"message": "Referral draft created.", "referral_id": ref_id}


@router.get("/referrals")
async def get_asha_referrals(
    status: Optional[str] = None,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    query: dict = {"referred_by": worker_email}
    if status:
        query["status"] = status

    cursor = referrals_history_collection.find(query, {"_id": 0}) \
        .sort("created_at", -1) \
        .limit(50)
    referrals = await cursor.to_list(length=50)
    return {"referrals": referrals, "count": len(referrals)}


# ─────────────────────────────────────────────
# VACCINATION OBSERVATIONS (reuses vaccinations_collection)
# ─────────────────────────────────────────────

@router.post("/vaccination-observations")
async def record_vaccination_observation(
    request: VaccinationObservationRequest,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    worker_name = current_user.get("name", "ASHA Worker")
    vac_id = f"VAC-ASHA-{uuid.uuid4().hex[:8].upper()}"

    vac_doc = {
        "vaccination_id": vac_id,
        "patient_id": request.patient_email,
        "patient_name": request.patient_name,
        "vaccine_name": request.vaccine_name,
        "vaccination_date": request.administered_date,
        "dose_number": request.dose_number,
        "batch_number": request.batch_number,
        "administered_by": request.administered_by or worker_name,
        "administered_by_email": worker_email,
        "administered_by_role": "asha_anm",
        "site": request.site,
        "adverse_reaction": request.adverse_reaction,
        "notes": request.notes,
        "status": "completed",
        "offline_id": request.offline_id,
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    await vaccinations_collection.insert_one(vac_doc)
    return {"message": "Vaccination observation recorded.", "vaccination_id": vac_id}


@router.get("/vaccination-observations")
async def get_vaccination_observations(
    patient_email: Optional[str] = None,
    current_user: dict = Depends(require_asha_role)
):
    worker_email = current_user["sub"]
    query: dict = {"administered_by_email": worker_email}
    if patient_email:
        query["patient_id"] = patient_email

    cursor = vaccinations_collection.find(query, {"_id": 0}) \
        .sort("created_at", -1) \
        .limit(50)
    records = await cursor.to_list(length=50)
    return {"records": records, "count": len(records)}
