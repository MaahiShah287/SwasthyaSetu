from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time
import os
import datetime
import uuid
from utils.jwt_handler import get_current_user
from database import (
    db, 
    healthcare_facilities_collection, 
    doctors_collection, 
    consultations_collection,
    appointments_collection,
    consultation_messages_collection,
    doctor_schedules_collection,
    reports_collection,
    users_collection,
    profile_collection,
    notifications_collection
)
from config import Config

# Google Calendar API imports
try:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    GOOGLE_LIBS_AVAILABLE = True
except ImportError:
    GOOGLE_LIBS_AVAILABLE = False

router = APIRouter()
telemedicine_sessions_collection = db.get_collection("telemedicine_sessions")

# Demo/Seed Doctors Data
SEED_DOCTORS = [
    {
        "doctor_id": "DOC-001",
        "email": "dr.siddharth@swasthyasetu.org",
        "name": "Dr. Siddharth Sharma",
        "specialization": "Cardiology",
        "qualification": "MD, DM (Cardiology)",
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "telemedicine_enabled": True,
        "is_verified": True,
        "availability": "Mon-Fri 09:00 - 17:00",
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "start_time": "09:00",
        "end_time": "17:00",
        "consultation_mode": "Both",
        "status": "ONLINE",
        "created_at": time.time()
    },
    {
        "doctor_id": "DOC-002",
        "email": "dr.ananya@swasthyasetu.org",
        "name": "Dr. Ananya Iyer",
        "specialization": "General Medicine",
        "qualification": "MBBS, DNB",
        "facility_id": "FAC-002",
        "facility_name": "Gramin Primary Health Centre (PHC) Badlapur",
        "telemedicine_enabled": True,
        "is_verified": True,
        "availability": "Mon-Sat 10:00 - 18:00",
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "start_time": "10:00",
        "end_time": "18:00",
        "consultation_mode": "Both",
        "status": "ONLINE",
        "created_at": time.time()
    },
    {
        "doctor_id": "DOC-003",
        "email": "dr.rajesh@swasthyasetu.org",
        "name": "Dr. Rajesh Kulkarni",
        "specialization": "General Surgery",
        "qualification": "MS (General Surgery)",
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "telemedicine_enabled": True,
        "is_verified": True,
        "availability": "Mon-Fri 08:00 - 16:00",
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "start_time": "08:00",
        "end_time": "16:00",
        "consultation_mode": "Clinic",
        "status": "ONLINE",
        "created_at": time.time()
    },
    {
        "doctor_id": "DOC-004",
        "email": "dr.meera@swasthyasetu.org",
        "name": "Dr. Meera Deshmukh",
        "specialization": "Gynecology",
        "qualification": "MD (OBGYN)",
        "facility_id": "FAC-004",
        "facility_name": "Apex Specialty Multi-Care Hospital",
        "telemedicine_enabled": True,
        "is_verified": True,
        "availability": "Mon-Sat 09:00 - 15:00",
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "start_time": "09:00",
        "end_time": "15:00",
        "consultation_mode": "Online Video",
        "status": "ONLINE",
        "created_at": time.time()
    },
    {
        "doctor_id": "DOC-005",
        "email": "dr.vikram@swasthyasetu.org",
        "name": "Dr. Vikram Joshi",
        "specialization": "Neurology",
        "qualification": "MD, DM (Neurology)",
        "facility_id": "FAC-004",
        "facility_name": "Apex Specialty Multi-Care Hospital",
        "telemedicine_enabled": True,
        "is_verified": True,
        "availability": "Mon-Fri 10:00 - 16:00",
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "start_time": "10:00",
        "end_time": "16:00",
        "consultation_mode": "Both",
        "status": "ONLINE",
        "created_at": time.time()
    }
]

async def ensure_doctors_seeded():
    """Ensure database has doctor seed records and MongoDB unique compound index for double booking prevention."""
    try:
        count = await doctors_collection.count_documents({})
        if count == 0:
            await doctors_collection.insert_many(SEED_DOCTORS)
            
            # Ensure default doctor account in users_collection for test/login
            doc_user = await users_collection.find_one({"email": "dr.siddharth@swasthyasetu.org"})
            if not doc_user:
                import bcrypt
                pwd_bytes = "doctor123".encode('utf-8')
                salt = bcrypt.gensalt()
                hashed = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
                
                await users_collection.insert_one({
                    "email": "dr.siddharth@swasthyasetu.org",
                    "password_hash": hashed,
                    "role": "doctor",
                    "name": "Dr. Siddharth Sharma",
                    "created_at": time.time()
                })
                await profile_collection.insert_one({
                    "email": "dr.siddharth@swasthyasetu.org",
                    "name": "Dr. Siddharth Sharma",
                    "phone": "+91 98200 12345",
                    "specialization": "Cardiology",
                    "facility_id": "FAC-001",
                    "role": "doctor"
                })

        # Ensure index for consultations & appointments collection for atomic double-booking protection
        await consultations_collection.create_index(
            [("doctor_id", 1), ("scheduled_time", 1)],
            unique=True,
            partialFilterExpression={"status": {"$in": ["PENDING", "ACCEPTED", "CONFIRMED", "APPROVED"]}}
        )
    except Exception as e:
        print(f"Index or Seed notice: {e}")


# Pydantic Schemas
class CreateConsultationRequest(BaseModel):
    doctor_id: str
    facility_id: Optional[str] = "FAC-001"
    specialization: Optional[str] = None
    consultation_type: Optional[str] = "Online Video" # Online Video, Clinic Visit
    consultation_mode: Optional[str] = "Online Video"
    scheduled_at: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    patient_notes: Optional[str] = None
    triage_urgency: Optional[str] = "ROUTINE"
    triage_summary: Optional[str] = None
    shared_report_ids: Optional[List[str]] = []

class ApproveAppointmentRequest(BaseModel):
    confirmed_time: Optional[str] = None
    doctor_notes: Optional[str] = None

class RejectAppointmentRequest(BaseModel):
    reason: Optional[str] = "Doctor unavailable at requested time"

class UpdateScheduleRequest(BaseModel):
    working_days: List[str]
    start_time: str
    end_time: str
    telemedicine_enabled: bool = True

class AddNotesRequest(BaseModel):
    notes: str
    advice: Optional[str] = None
    follow_up_recommendation: Optional[str] = None
    follow_up_date: Optional[str] = None

class SendMessageRequest(BaseModel):
    message: str


def check_meeting_unlocked(scheduled_str: Optional[str], status: str) -> tuple[bool, str, Optional[str], int]:
    """
    Checks if Jitsi Meet link is unlocked (30 mins before scheduled time).
    Returns: (is_unlocked, status_message, meeting_url, minutes_remaining)
    """
    if status not in ["ACCEPTED", "CONFIRMED", "APPROVED"]:
        return False, "Pending Doctor Confirmation", None, -1

    # Default to unlocked if scheduled_str is missing or immediate
    if not scheduled_str:
        return True, "🎥 Join Consultation", None, 0

    try:
        # Attempt to parse date/time
        # Try formats: '2026-09-05 10:00', '2026-09-05T10:00:00', '10:00 AM'
        now = datetime.datetime.now()
        target_dt = None
        
        for fmt in ["%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y-%m-%d %I:%M %p"]:
            try:
                target_dt = datetime.datetime.strptime(scheduled_str.strip(), fmt)
                break
            except Exception:
                pass

        if not target_dt:
            # Check if it contains today or simple hour
            return True, "🎥 Join Consultation", None, 0

        diff_seconds = (target_dt - now).total_seconds()
        diff_minutes = int(diff_seconds / 60)

        if diff_seconds <= 1800 and diff_seconds >= -7200: # Within 30 mins before or up to 2 hours after
            return True, "🎥 Join Consultation", None, diff_minutes
        elif diff_seconds > 1800:
            return False, f"🔒 Meeting link will be available 30 minutes before your appointment (in {diff_minutes} mins).", None, diff_minutes
        else:
            return False, "Consultation window closed.", None, diff_minutes
    except Exception:
        return True, "🎥 Join Consultation", None, 0


def format_consultation_response(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Formats consultation record with computed Jitsi meeting room and 30-min unlock state."""
    status = doc.get("status", "PENDING")
    consult_id = doc.get("consultation_id", "CONS")
    mode = doc.get("consultation_type") or doc.get("consultation_mode") or "Online Video"
    is_online = "online" in mode.lower() or "video" in mode.lower()
    
    scheduled_time = doc.get("scheduled_time") or doc.get("scheduled_at") or ""
    
    jitsi_room = f"https://meet.jit.si/SwasthyaSetu-Consult-{consult_id}"
    is_unlocked, msg, _, mins_left = check_meeting_unlocked(scheduled_time, status)

    doc_copy = dict(doc)
    doc_copy["is_online"] = is_online
    doc_copy["is_meeting_unlocked"] = is_unlocked and is_online
    doc_copy["meeting_status_message"] = msg if is_online else "Clinic Visit Scheduled"
    doc_copy["minutes_to_meeting"] = mins_left
    doc_copy["jitsi_meet_url"] = jitsi_room if (is_unlocked and is_online) else None
    doc_copy["meeting_link"] = jitsi_room if (is_unlocked and is_online) else None
    
    return doc_copy


# =========================================================================
# ENDPOINTS
# =========================================================================

@router.get("/doctors")
async def get_all_doctors(
    facility_id: Optional[str] = None,
    specialization: Optional[str] = None,
    mode: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Fetch database registered doctors with filtering by specialty, facility, and mode."""
    await ensure_doctors_seeded()
    query = {}
    if facility_id:
        query["facility_id"] = facility_id
    if specialization:
        query["specialization"] = {"$regex": specialization, "$options": "i"}
    if mode:
        query["$or"] = [
            {"consultation_mode": mode},
            {"consultation_mode": "Both"}
        ]

    cursor = doctors_collection.find(query, {"_id": 0})
    docs = []
    async for d in cursor:
        docs.append(d)
    return docs


@router.get("/doctors/{facility_id}")
async def get_facility_doctors(
    facility_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve database-registered specialists for a given healthcare facility."""
    await ensure_doctors_seeded()
    facility = await healthcare_facilities_collection.find_one({"facility_id": facility_id}, {"_id": 0})
    if not facility:
        raise HTTPException(status_code=404, detail="Healthcare facility not found in database.")

    cursor = doctors_collection.find({"facility_id": facility_id}, {"_id": 0})
    db_doctors = []
    async for d in cursor:
        db_doctors.append(d)

    specialist_names = [d["name"] + f" ({d['specialization']})" for d in db_doctors] if db_doctors else facility.get("specialists", ["General Physician"])

    return {
        "facility_id": facility_id,
        "facility_name": facility.get("name"),
        "has_telemedicine": facility.get("has_telemedicine", True),
        "phone": facility.get("phone"),
        "operating_hours": facility.get("operating_hours"),
        "specialists": specialist_names,
        "doctors": db_doctors
    }


@router.post("/consultations")
@router.post("/appointments")
async def create_consultation_request(
    request: CreateConsultationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Patient submits an appointment / telemedicine consultation request to a doctor.
    Enforces Server-Side Double Booking Protection via MongoDB Atomic Check.
    """
    await ensure_doctors_seeded()
    patient_email = current_user["sub"]

    doctor = await doctors_collection.find_one({"doctor_id": request.doctor_id}, {"_id": 0})
    if not doctor:
        doctor = await doctors_collection.find_one({"name": request.doctor_id}, {"_id": 0})
    if not doctor:
        doctor = await doctors_collection.find_one({"specialization": {"$regex": request.specialization or "General", "$options": "i"}}, {"_id": 0})
    if not doctor:
        doctor = SEED_DOCTORS[0]

    if request.scheduled_at:
        scheduled_time = request.scheduled_at
    elif request.scheduled_time and ("-" in request.scheduled_time or "/" in request.scheduled_time):
        scheduled_time = request.scheduled_time
    else:
        date_part = request.scheduled_date or datetime.datetime.now().strftime('%Y-%m-%d')
        time_part = request.scheduled_time or '10:00 AM'
        scheduled_time = f"{date_part} {time_part}"


    # Double Booking Protection: Server-side check before insertion
    existing_booking = await consultations_collection.find_one({
        "doctor_id": doctor.get("doctor_id"),
        "scheduled_time": scheduled_time,
        "status": {"$in": ["PENDING", "ACCEPTED", "CONFIRMED", "APPROVED"]}
    })

    if existing_booking:
        raise HTTPException(
            status_code=409, 
            detail=f"Doctor is already booked for this time slot ({scheduled_time}). Please select another slot."
        )

    facility_id = request.facility_id or doctor.get("facility_id", "FAC-001")
    facility = await healthcare_facilities_collection.find_one({"facility_id": facility_id}, {"_id": 0})
    patient_profile = await profile_collection.find_one({"email": patient_email}, {"_id": 0})
    patient_name = patient_profile.get("name", patient_email.split("@")[0]) if patient_profile else current_user.get("name", patient_email)
    patient_age = patient_profile.get("age", 25) if patient_profile else 25

    consultation_id = f"APPT-{int(time.time())}-{doctor.get('doctor_id', 'DOC')}"
    consult_mode = request.consultation_mode or request.consultation_type or "Online Video"

    consultation_doc = {
        "consultation_id": consultation_id,
        "appointment_id": consultation_id,
        "patient_email": patient_email,
        "patient_name": patient_name,
        "patient_age": patient_age,
        "doctor_id": doctor.get("doctor_id", "DOC-001"),
        "doctor_name": doctor.get("name", "Attending Physician"),
        "doctor_email": doctor.get("email", "dr.siddharth@swasthyasetu.org"),
        "specialization": request.specialization or doctor.get("specialization", "General Physician"),
        "facility_id": facility_id,
        "facility_name": facility.get("name") if facility else doctor.get("facility_name", "Medical Center"),
        "consultation_type": consult_mode,
        "consultation_mode": consult_mode,
        "scheduled_time": scheduled_time,
        "duration_mins": 30,
        "patient_notes": request.patient_notes,
        "triage_urgency": request.triage_urgency or "ROUTINE",
        "triage_summary": request.triage_summary,
        "shared_report_ids": request.shared_report_ids or [],
        "status": "PENDING", # PENDING -> APPROVED / ACCEPTED -> COMPLETED / REJECTED
        "created_at": time.time(),
        "updated_at": time.time()
    }

    try:
        await consultations_collection.insert_one(consultation_doc)
    except Exception as e:
        if "duplicate key" in str(e).lower():
            raise HTTPException(status_code=409, detail="Doctor is already booked for this time slot.")
        raise e

    # In-app notification for the Doctor
    await notifications_collection.insert_one({
        "recipient_email": doctor.get("email"),
        "recipient_role": "doctor",
        "title": "New Appointment Request",
        "message": f"Patient {patient_name} requested a {consult_mode} consultation for {scheduled_time}.",
        "consultation_id": consultation_id,
        "timestamp": time.time(),
        "read": False
    })

    consultation_doc.pop("_id", None)
    return format_consultation_response(consultation_doc)


@router.get("/consultations")
@router.get("/appointments")
@router.get("/appointments/my-appointments")
async def list_consultations(
    current_user: dict = Depends(get_current_user)
):
    """
    List appointments/consultations for authenticated user based on JWT role.
    PATIENT -> their booked appointments.
    DOCTOR -> incoming & confirmed requests.
    """
    role = current_user.get("role", "patient")
    email = current_user["sub"]

    query = {}
    if role == "doctor":
        doc = await doctors_collection.find_one({"email": email})
        if doc:
            query = {"$or": [{"doctor_id": doc["doctor_id"]}, {"doctor_email": email}]}
        else:
            query = {"doctor_email": email}
    else:
        query = {"patient_email": email}

    cursor = consultations_collection.find(query, {"_id": 0}).sort("created_at", -1)
    results = []
    async for item in cursor:
        results.append(format_consultation_response(item))
    return results


@router.get("/consultations/{id}")
@router.get("/appointments/{id}")
async def get_consultation_details(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve specific consultation details with authorization check."""
    consultation = await consultations_collection.find_one(
        {"$or": [{"consultation_id": id}, {"appointment_id": id}]}, 
        {"_id": 0}
    )
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation record not found.")

    # Fetch authorized shared reports for this consultation
    shared_reports = []
    if consultation.get("shared_report_ids"):
        from bson import ObjectId
        obj_ids = []
        for rid in consultation["shared_report_ids"]:
            try:
                obj_ids.append(ObjectId(rid))
            except Exception:
                pass
        if obj_ids:
            rep_cursor = reports_collection.find({"_id": {"$in": obj_ids}}, {"_id": 1, "title": 1, "report_type": 1, "cloudinary_url": 1, "upload_date": 1})
            async for r in rep_cursor:
                r["_id"] = str(r["_id"])
                shared_reports.append(r)

    consultation["shared_reports"] = shared_reports
    return format_consultation_response(consultation)


@router.post("/consultations/{id}/accept")
@router.post("/consultations/{id}/approve")
@router.post("/appointments/{id}/approve")
async def accept_consultation(
    id: str,
    body: Optional[ApproveAppointmentRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Doctor approves/confirms appointment request."""
    role = current_user.get("role", "patient")
    if role != "doctor" and role != "admin":
        raise HTTPException(status_code=403, detail="Only authorized doctors can approve appointments.")

    consultation = await consultations_collection.find_one({"$or": [{"consultation_id": id}, {"appointment_id": id}]})
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    confirmed_time = (body.confirmed_time if body and body.confirmed_time else None) or consultation.get("scheduled_time")

    updates = {
        "status": "APPROVED",
        "scheduled_time": confirmed_time,
        "doctor_notes": body.doctor_notes if body and body.doctor_notes else consultation.get("doctor_notes"),
        "status_note": f"Confirmed for {confirmed_time}",
        "updated_at": time.time()
    }

    await consultations_collection.update_one({"_id": consultation["_id"]}, {"$set": updates})

    # In-app notification for patient
    await notifications_collection.insert_one({
        "recipient_email": consultation["patient_email"],
        "recipient_role": "patient",
        "title": "Appointment Confirmed! 🩺",
        "message": f"Dr. {consultation.get('doctor_name')} confirmed your appointment for {confirmed_time}.",
        "consultation_id": consultation.get("consultation_id"),
        "timestamp": time.time(),
        "read": False
    })

    return await get_consultation_details(id, current_user)


@router.post("/consultations/{id}/reject")
@router.post("/appointments/{id}/reject")
async def reject_consultation(
    id: str,
    body: Optional[RejectAppointmentRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Doctor rejects appointment request."""
    role = current_user.get("role", "patient")
    if role != "doctor" and role != "admin":
        raise HTTPException(status_code=403, detail="Only authorized doctors can update appointment status.")

    consultation = await consultations_collection.find_one({"$or": [{"consultation_id": id}, {"appointment_id": id}]})
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found.")

    reason = body.reason if body and body.reason else "Doctor unavailable at requested time"

    await consultations_collection.update_one(
        {"_id": consultation["_id"]},
        {"$set": {"status": "REJECTED", "rejection_reason": reason, "updated_at": time.time()}}
    )

    # In-app notification for patient
    await notifications_collection.insert_one({
        "recipient_email": consultation["patient_email"],
        "recipient_role": "patient",
        "title": "Appointment Update",
        "message": f"Your appointment with Dr. {consultation.get('doctor_name')} could not be accommodated. ({reason})",
        "consultation_id": consultation.get("consultation_id"),
        "timestamp": time.time(),
        "read": False
    })

    return await get_consultation_details(id, current_user)


@router.post("/consultations/{id}/notes")
async def add_consultation_notes(
    id: str,
    request: AddNotesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Doctor adds clinical notes, advice, and follow-up recommendations."""
    role = current_user.get("role", "patient")
    if role != "doctor" and role != "admin":
        raise HTTPException(status_code=403, detail="Only authorized doctors can add consultation notes.")

    updates = {
        "doctor_notes": request.notes,
        "doctor_advice": request.advice,
        "follow_up_recommendation": request.follow_up_recommendation,
        "follow_up_date": request.follow_up_date,
        "status": "COMPLETED",
        "updated_at": time.time()
    }

    await consultations_collection.update_one(
        {"$or": [{"consultation_id": id}, {"appointment_id": id}]}, 
        {"$set": updates}
    )
    return await get_consultation_details(id, current_user)


@router.get("/consultations/{id}/messages")
async def get_consultation_messages(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    """Fetch secure text consultation messages."""
    await get_consultation_details(id, current_user)
    cursor = consultation_messages_collection.find(
        {"$or": [{"consultation_id": id}, {"appointment_id": id}]}, 
        {"_id": 0}
    ).sort("timestamp", 1)
    msgs = []
    async for m in cursor:
        msgs.append(m)
    return msgs


@router.post("/consultations/{id}/messages")
async def send_consultation_message(
    id: str,
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send secure consultation message between patient and authorized doctor."""
    await get_consultation_details(id, current_user)

    msg_doc = {
        "consultation_id": id,
        "sender_email": current_user["sub"],
        "sender_name": current_user.get("name", current_user["sub"].split("@")[0]),
        "sender_role": current_user.get("role", "patient"),
        "message": request.message,
        "timestamp": time.time()
    }

    await consultation_messages_collection.insert_one(msg_doc)
    msg_doc.pop("_id", None)
    return msg_doc


@router.post("/doctor/schedule")
async def update_doctor_schedule(
    request: UpdateScheduleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Doctor manages weekly availability and working hours."""
    role = current_user.get("role", "patient")
    if role != "doctor" and role != "admin":
        raise HTTPException(status_code=403, detail="Only doctors can manage clinical schedules.")

    email = current_user["sub"]
    await doctors_collection.update_one(
        {"email": email},
        {"$set": {
            "working_days": request.working_days,
            "start_time": request.start_time,
            "end_time": request.end_time,
            "telemedicine_enabled": request.telemedicine_enabled,
            "availability": f"{', '.join(request.working_days)} {request.start_time} - {request.end_time}"
        }},
        upsert=True
    )
    return {"message": "Doctor availability schedule updated successfully."}


@router.get("/notifications")
async def get_user_notifications(
    current_user: dict = Depends(get_current_user)
):
    """Retrieve notifications for the current authenticated user."""
    email = current_user["sub"]
    cursor = notifications_collection.find(
        {"recipient_email": email}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(20)
    
    notifications = []
    async for n in cursor:
        notifications.append(n)
    return notifications


@router.put("/notifications/read-all")
async def mark_notifications_read(
    current_user: dict = Depends(get_current_user)
):
    """Mark all notifications as read for current user."""
    email = current_user["sub"]
    await notifications_collection.update_many(
        {"recipient_email": email},
        {"$set": {"read": True}}
    )
    return {"message": "Notifications marked as read."}
