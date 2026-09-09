from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time
import uuid
from datetime import datetime, date
from utils.jwt_handler import get_current_user
from database import (
    db,
    follow_ups_collection,
    notifications_collection,
    audit_logs_collection,
    doctors_collection,
    consultations_collection,
    appointments_collection,
    hospital_bookings_collection,
    profile_collection,
    users_collection,
    reports_collection,
    referrals_history_collection
)
from services.ai_service import AIService

router = APIRouter()

# Enums
VALID_TYPES = [
    "DOCTOR_VISIT",
    "TREATMENT_REVIEW",
    "REFERRAL",
    "LAB_TEST",
    "DIAGNOSTIC_REVIEW",
    "TELEMEDICINE",
    "MEDICATION_REVIEW",
    "POST_DISCHARGE",
    "ROUTINE_CHECKUP",
    "RECOVERY_MONITORING",
    "CHRONIC_CARE",
    "POST_PROCEDURE",
    "GENERAL_FOLLOWUP",
    "OTHER"
]

VALID_STATUSES = [
    "PENDING",
    "PENDING_PATIENT",
    "CHANGE_REQUESTED",
    "CONFIRMED",
    "RESCHEDULED",
    "DUE_TODAY",
    "DUE",
    "COMPLETED",
    "OVERDUE",
    "CANCELLED",
    "DECLINED"
]

VALID_PRIORITIES = [
    "LOW",
    "NORMAL",
    "HIGH",
    "URGENT"
]

# Types requiring clinical verification before patient completion
CLINICAL_VERIFICATION_TYPES = [
    "POST_DISCHARGE",
    "TREATMENT_REVIEW",
    "DIAGNOSTIC_REVIEW",
    "REFERRAL",
    "POST_PROCEDURE"
]

# Pydantic Schemas
class FollowUpCreate(BaseModel):
    patient_id: Optional[str] = Field(None, description="Patient email/ID. If omitted, defaults to current authenticated user")
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_id: Optional[str] = None
    hospital_name: Optional[str] = None
    appointment_id: Optional[str] = None
    consultation_id: Optional[str] = None
    referral_id: Optional[str] = None
    medical_record_id: Optional[str] = None
    medical_record_ids: Optional[List[str]] = None
    follow_up_type: str = Field("TREATMENT_REVIEW", description="Type of follow-up")
    title: str = Field("Follow-Up Consultation", description="Short title for follow-up")
    description: Optional[str] = ""
    purpose: Optional[str] = None
    doctor_instructions: Optional[str] = None
    doctor_notes: Optional[str] = None
    treatment_name: Optional[str] = None
    recommended_department: Optional[str] = None
    due_date: str = Field(..., description="Format YYYY-MM-DD")
    due_time: Optional[str] = "10:00"
    priority: str = Field("NORMAL", description="LOW, NORMAL, HIGH, URGENT")
    is_online: Optional[bool] = True
    reminder_enabled: bool = True
    reminder_days_before: int = 1


class FollowUpUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    purpose: Optional[str] = None
    doctor_instructions: Optional[str] = None
    doctor_notes: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    priority: Optional[str] = None
    reminder_enabled: Optional[bool] = None
    reminder_days_before: Optional[int] = None
    medical_record_id: Optional[str] = None
    medical_record_ids: Optional[List[str]] = None
    referral_id: Optional[str] = None


class FollowUpChangeRequest(BaseModel):
    requested_date: str = Field(..., description="Format YYYY-MM-DD")
    requested_time: Optional[str] = "10:00"
    message: Optional[str] = None


class FollowUpComplete(BaseModel):
    completion_notes: Optional[str] = "Follow-up marked completed."
    outcome: Optional[str] = None
    doctor_notes: Optional[str] = None
    treatment_progress: Optional[str] = None
    referral_required: Optional[bool] = False
    create_next_follow_up: Optional[bool] = False


class FollowUpCancel(BaseModel):
    reason: Optional[str] = "Cancelled by user."


class FollowUpReschedule(BaseModel):
    new_due_date: str = Field(..., description="Format YYYY-MM-DD")
    new_due_time: Optional[str] = "10:00"
    reason: Optional[str] = "Rescheduled."


class AIExplainFollowUpRequest(BaseModel):
    follow_up_id: Optional[str] = None
    doctor_instructions: Optional[str] = None
    purpose: Optional[str] = None


# Helper Functions
def compute_followup_status(
    due_date_str: str, 
    is_completed: bool = False, 
    is_cancelled: bool = False,
    explicit_status: Optional[str] = None
) -> str:
    """
    Server-side deterministic status calculation engine.
    Frontend is never the source of truth for status.
    """
    if explicit_status in ["CANCELLED", "DECLINED", "COMPLETED", "CHANGE_REQUESTED", "PENDING_PATIENT"]:
        return explicit_status
    if is_cancelled:
        return "CANCELLED"
    if is_completed:
        return "COMPLETED"

    try:
        due_date_obj = datetime.strptime(due_date_str, "%Y-%m-%d").date()
    except Exception:
        return explicit_status or "PENDING"

    today = date.today()
    if due_date_obj < today:
        return "OVERDUE"
    elif due_date_obj == today:
        return "DUE_TODAY"
    else:
        if explicit_status in ["CONFIRMED", "RESCHEDULED", "DUE"]:
            return explicit_status
        return explicit_status or "PENDING"


async def log_audit_event(
    user_email: str,
    role: str,
    action: str,
    patient_id: str,
    follow_up_id: str,
    details: Dict[str, Any]
):
    """Log event into clinical audit engine."""
    audit_entry = {
        "user": user_email,
        "role": role,
        "action": action,
        "patient_id": patient_id,
        "follow_up_id": follow_up_id,
        "timestamp": time.time(),
        "details": details
    }
    try:
        await audit_logs_collection.insert_one(audit_entry)
    except Exception as e:
        print(f"Audit log insertion error: {e}")


async def send_followup_reminder(
    patient_email: str,
    follow_up_id: str,
    title: str,
    reminder_type: str,
    due_date_str: str
):
    """
    Generate reminders with deterministic deduplication on
    (recipient_email, follow_up_id, reminder_type, scheduled_date).
    """
    today_str = date.today().strftime("%Y-%m-%d")

    existing = await notifications_collection.find_one({
        "recipient_email": patient_email,
        "follow_up_id": follow_up_id,
        "reminder_type": reminder_type,
        "scheduled_date": today_str
    })
    if existing:
        return

    msg_map = {
        "UPCOMING_7": f"Upcoming follow-up: '{title}' on {due_date_str}.",
        "UPCOMING_1": f"Your follow-up '{title}' is tomorrow ({due_date_str}).",
        "DUE_TODAY": f"Your follow-up '{title}' is due today ({due_date_str}).",
        "OVERDUE": f"Follow-up overdue for '{title}' (due {due_date_str}). Please contact your healthcare provider if you still need care."
    }

    notification_doc = {
        "recipient_email": patient_email,
        "recipient_role": "patient",
        "title": f"Follow-Up Reminder: {title}",
        "message": msg_map.get(reminder_type, f"Follow-up update for '{title}'."),
        "type": "FOLLOW_UP_REMINDER",
        "follow_up_id": follow_up_id,
        "reminder_type": reminder_type,
        "scheduled_date": today_str,
        "due_date": due_date_str,
        "timestamp": time.time(),
        "read": False
    }
    try:
        await notifications_collection.insert_one(notification_doc)
        await log_audit_event(
            user_email="system@swasthyasetu.org",
            role="system",
            action="REMINDER_SENT",
            patient_id=patient_email,
            follow_up_id=follow_up_id,
            details={"reminder_type": reminder_type, "scheduled_date": today_str}
        )
    except Exception as e:
        print(f"Notification error: {e}")


async def verify_authorization(
    current_user: dict, 
    target_patient_id: str, 
    doctor_id: Optional[str] = None, 
    hospital_id: Optional[str] = None
) -> bool:
    """
    Strict server-side authorization:
    - Patient: own records only.
    - Doctor: authorized patients (created follow-up, assigned doctor, or existing consultation/appointment).
    - Hospital: authorized patients (created follow-up, matching facility, or hospital booking).
    - Admin: allowed.
    """
    user_email = current_user.get("sub", "")
    role = current_user.get("role", "patient")

    if role == "admin":
        return True

    if role == "patient":
        return user_email == target_patient_id

    if role == "doctor":
        # Check doctor profile or email match
        doc = await doctors_collection.find_one({"email": user_email})
        user_doc_id = doc.get("doctor_id") if doc else current_user.get("doctor_id")

        if doctor_id and (doctor_id == user_doc_id or doctor_id == user_email):
            return True

        has_appt = await appointments_collection.find_one({
            "$or": [
                {"doctor_email": user_email, "patient_email": target_patient_id},
                {"doctor_id": user_doc_id, "patient_email": target_patient_id}
            ]
        })
        has_consult = await consultations_collection.find_one({
            "$or": [
                {"doctor_email": user_email, "patient_email": target_patient_id},
                {"doctor_id": user_doc_id, "patient_email": target_patient_id}
            ]
        })
        return bool(has_appt or has_consult or user_email == target_patient_id)

    if role == "hospital":
        user_fac_id = current_user.get("facility_id")
        if hospital_id and (hospital_id == user_fac_id or hospital_id == user_email):
            return True

        has_booking = await hospital_bookings_collection.find_one({
            "$or": [
                {"facility_id": user_fac_id, "patient_email": target_patient_id},
                {"hospital_email": user_email, "patient_email": target_patient_id}
            ]
        })
        return bool(has_booking or user_email == target_patient_id)

    return False


def format_follow_up_doc(doc: dict) -> dict:
    """Format MongoDB document into clean response dict with computed status."""
    doc_id = str(doc.get("_id", ""))
    explicit_st = doc.get("status")
    is_completed = explicit_st == "COMPLETED"
    is_cancelled = explicit_st == "CANCELLED"
    
    current_status = compute_followup_status(
        due_date_str=doc.get("due_date", ""),
        is_completed=is_completed,
        is_cancelled=is_cancelled,
        explicit_status=explicit_st
    )

    # Days overdue calculation
    days_overdue = 0
    if current_status == "OVERDUE":
        try:
            d_obj = datetime.strptime(doc.get("due_date", ""), "%Y-%m-%d").date()
            days_overdue = (date.today() - d_obj).days
        except Exception:
            days_overdue = 1

    meeting_link = doc.get("meeting_link")
    if not meeting_link and (doc.get("is_online", True) or doc.get("follow_up_type") == "TELEMEDICINE"):
        meeting_link = f"/consultation/{doc.get('consultation_id') or doc.get('appointment_id') or doc.get('follow_up_id')}"

    return {
        "follow_up_id": doc.get("follow_up_id", doc_id),
        "patient_id": doc.get("patient_id"),
        "created_by": doc.get("created_by"),
        "created_by_role": doc.get("created_by_role", "patient"),
        "doctor_id": doc.get("doctor_id"),
        "doctor_name": doc.get("doctor_name"),
        "hospital_id": doc.get("hospital_id"),
        "hospital_name": doc.get("hospital_name"),
        "appointment_id": doc.get("appointment_id"),
        "consultation_id": doc.get("consultation_id"),
        "referral_id": doc.get("referral_id"),
        "medical_record_id": doc.get("medical_record_id"),
        "medical_record_ids": doc.get("medical_record_ids") or ([] if not doc.get("medical_record_id") else [doc.get("medical_record_id")]),
        "follow_up_type": doc.get("follow_up_type", "ROUTINE_CHECKUP"),
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "purpose": doc.get("purpose", doc.get("description", "")),
        "doctor_instructions": doc.get("doctor_instructions", ""),
        "doctor_notes": doc.get("doctor_notes", ""),
        "treatment_name": doc.get("treatment_name"),
        "recommended_department": doc.get("recommended_department"),
        "due_date": doc.get("due_date", ""),
        "due_time": doc.get("due_time", "10:00"),
        "status": current_status,
        "priority": doc.get("priority", "NORMAL"),
        "change_request": doc.get("change_request"),
        "reminder_enabled": doc.get("reminder_enabled", True),
        "reminder_days_before": doc.get("reminder_days_before", 1),
        "outcome": doc.get("outcome"),
        "completed_at": doc.get("completed_at"),
        "completed_by": doc.get("completed_by"),
        "completion_notes": doc.get("completion_notes"),
        "days_overdue": days_overdue,
        "is_online": doc.get("is_online", True),
        "meeting_link": meeting_link,
        "created_at": doc.get("created_at", time.time()),
        "updated_at": doc.get("updated_at", time.time())
    }



# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@router.get("/summary")
async def get_followup_summary(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get aggregated summary counts for follow-ups.
    """
    target_patient = patient_id or current_user.get("sub")
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Unauthorized access to patient summary")

    cursor = follow_ups_collection.find({"patient_id": target_patient})
    total = 0
    due_today = 0
    upcoming = 0
    overdue = 0
    completed = 0
    pending_referrals = 0
    pending_reports = 0
    treatment_followups = 0

    async for doc in cursor:
        formatted = format_follow_up_doc(doc)
        total += 1
        st = formatted["status"]
        tp = formatted["follow_up_type"]

        if st == "COMPLETED":
            completed += 1
        elif st == "DUE_TODAY":
            due_today += 1
        elif st == "OVERDUE":
            overdue += 1
        elif st == "PENDING":
            upcoming += 1

        if st in ["PENDING", "DUE_TODAY", "OVERDUE"]:
            if tp == "REFERRAL":
                pending_referrals += 1
            elif tp in ["LAB_TEST", "DIAGNOSTIC_REVIEW"]:
                pending_reports += 1
            elif tp in ["TREATMENT_REVIEW", "MEDICATION_REVIEW", "POST_DISCHARGE"]:
                treatment_followups += 1

    return {
        "patient_id": target_patient,
        "total": total,
        "due_today": due_today,
        "upcoming": upcoming,
        "overdue": overdue,
        "completed": completed,
        "pending_referrals": pending_referrals,
        "pending_reports": pending_reports,
        "treatment_followups": treatment_followups
    }


@router.get("/upcoming")
async def get_upcoming_followups(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get upcoming follow-ups (DUE_TODAY and PENDING)."""
    target_patient = patient_id or current_user.get("sub")
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    cursor = follow_ups_collection.find({"patient_id": target_patient}).sort("due_date", 1)
    results = []
    async for doc in cursor:
        formatted = format_follow_up_doc(doc)
        if formatted["status"] in ["DUE_TODAY", "PENDING"]:
            results.append(formatted)

        # Trigger reminder check asynchronously for due today or upcoming
        if formatted["reminder_enabled"]:
            if formatted["status"] == "DUE_TODAY":
                await send_followup_reminder(
                    patient_email=target_patient,
                    follow_up_id=formatted["follow_up_id"],
                    title=formatted["title"],
                    reminder_type="DUE_TODAY",
                    due_date_str=formatted["due_date"]
                )

    return results


@router.get("/overdue")
async def get_overdue_followups(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get overdue follow-ups."""
    target_patient = patient_id or current_user.get("sub")
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    cursor = follow_ups_collection.find({"patient_id": target_patient}).sort("due_date", 1)
    results = []
    async for doc in cursor:
        formatted = format_follow_up_doc(doc)
        if formatted["status"] == "OVERDUE":
            results.append(formatted)
            if formatted["reminder_enabled"]:
                await send_followup_reminder(
                    patient_email=target_patient,
                    follow_up_id=formatted["follow_up_id"],
                    title=formatted["title"],
                    reminder_type="OVERDUE",
                    due_date_str=formatted["due_date"]
                )

    return results


@router.get("/history")
async def get_followup_history(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get completed or cancelled follow-up history."""
    target_patient = patient_id or current_user.get("sub")
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Unauthorized access")

    cursor = follow_ups_collection.find({"patient_id": target_patient}).sort("updated_at", -1)
    results = []
    async for doc in cursor:
        formatted = format_follow_up_doc(doc)
        if formatted["status"] in ["COMPLETED", "CANCELLED"]:
            results.append(formatted)

    return results


@router.get("")
@router.get("/")
async def list_followups(
    patient_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    type_filter: Optional[str] = Query(None, alias="type"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    current_user: dict = Depends(get_current_user)
):
    """
    List follow-ups with role-based filtering.
    Patients get their own follow-ups.
    Doctors get follow-ups for their patients or created by them.
    Hospitals get follow-ups for their facility.
    """
    role = current_user.get("role", "patient")
    user_email = current_user.get("sub", "")

    query: Dict[str, Any] = {}

    if role == "patient":
        query["patient_id"] = user_email
    elif role == "doctor":
        doc = await doctors_collection.find_one({"email": user_email})
        doctor_id = doc.get("doctor_id") if doc else current_user.get("doctor_id")
        if patient_id:
            if not await verify_authorization(current_user, patient_id, doctor_id=doctor_id):
                raise HTTPException(status_code=403, detail="Unauthorized access to patient follow-ups")
            query["patient_id"] = patient_id
        else:
            query["$or"] = [
                {"doctor_id": doctor_id},
                {"doctor_id": user_email},
                {"created_by": user_email}
            ]
    elif role == "hospital":
        fac_id = current_user.get("facility_id")
        if patient_id:
            if not await verify_authorization(current_user, patient_id, hospital_id=fac_id):
                raise HTTPException(status_code=403, detail="Unauthorized access to patient follow-ups")
            query["patient_id"] = patient_id
        else:
            query["$or"] = [
                {"hospital_id": fac_id},
                {"hospital_id": user_email},
                {"created_by": user_email}
            ]
    elif role == "admin":
        if patient_id:
            query["patient_id"] = patient_id

    if type_filter and type_filter.upper() in VALID_TYPES:
        query["follow_up_type"] = type_filter.upper()

    if priority_filter and priority_filter.upper() in VALID_PRIORITIES:
        query["priority"] = priority_filter.upper()

    cursor = follow_ups_collection.find(query).sort("due_date", 1)
    results = []
    async for doc in cursor:
        formatted = format_follow_up_doc(doc)
        if status_filter:
            if formatted["status"].upper() == status_filter.upper():
                results.append(formatted)
        else:
            results.append(formatted)

    return results


@router.get("/pending")
async def get_pending_followups(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get pending follow-up requests awaiting patient response or doctor change approval."""
    user_email = current_user.get("sub", "")
    role = current_user.get("role", "patient")

    query: Dict[str, Any] = {}
    if role == "patient":
        query["patient_id"] = user_email
        query["status"] = {"$in": ["PENDING_PATIENT", "CHANGE_REQUESTED"]}
    elif role == "doctor":
        doc = await doctors_collection.find_one({"email": user_email})
        doc_id = doc.get("doctor_id") if doc else current_user.get("doctor_id")
        query["$or"] = [{"doctor_id": doc_id}, {"doctor_id": user_email}, {"created_by": user_email}]
        query["status"] = {"$in": ["PENDING_PATIENT", "CHANGE_REQUESTED"]}
    else:
        query["status"] = {"$in": ["PENDING_PATIENT", "CHANGE_REQUESTED"]}

    cursor = follow_ups_collection.find(query).sort("created_at", -1)
    results = []
    async for doc in cursor:
        results.append(format_follow_up_doc(doc))
    return results


@router.post("/ai-explain")
async def ai_explain_followup(
    payload: AIExplainFollowUpRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate patient-friendly AI explanation for follow-up purpose & doctor instructions.
    AI MUST NOT alter follow-up dates, prescribe treatments, or generate referrals.
    """
    doctor_instructions = payload.doctor_instructions or ""
    purpose = payload.purpose or ""

    if payload.follow_up_id:
        doc = await follow_ups_collection.find_one({"follow_up_id": payload.follow_up_id})
        if doc:
            doctor_instructions = doctor_instructions or doc.get("doctor_instructions") or doc.get("description", "")
            purpose = purpose or doc.get("purpose") or doc.get("title", "")

    if not doctor_instructions and not purpose:
        raise HTTPException(status_code=400, detail="Doctor instructions or purpose required for AI explanation")

    explanation = await AIService.explain_followup_instructions(
        doctor_instructions=doctor_instructions,
        purpose=purpose
    )
    return explanation


@router.post("")
@router.post("/")
async def create_followup(
    payload: FollowUpCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new follow-up record with RBAC authorization & validation.
    """
    user_email = current_user.get("sub", "")
    role = current_user.get("role", "patient")

    target_patient = payload.patient_id or user_email

    # RBAC check
    if not await verify_authorization(current_user, target_patient, doctor_id=payload.doctor_id, hospital_id=payload.hospital_id):
        raise HTTPException(status_code=403, detail="Unauthorized to create follow-up for target patient")

    # Validate type and priority
    tp = payload.follow_up_type.upper()
    if tp not in VALID_TYPES:
        tp = "ROUTINE_CHECKUP"

    pr = payload.priority.upper()
    if pr not in VALID_PRIORITIES:
        pr = "NORMAL"

    follow_up_id = f"FLP-{uuid.uuid4().hex[:8].upper()}"

    # Determine status: doctor requests require patient acceptance (PENDING_PATIENT)
    if role in ["doctor", "hospital"] and target_patient != user_email:
        init_status = "PENDING_PATIENT"
    else:
        init_status = compute_followup_status(payload.due_date, explicit_status="CONFIRMED" if role in ["doctor", "hospital"] else None)

    doc = {
        "follow_up_id": follow_up_id,
        "patient_id": target_patient,
        "created_by": user_email,
        "created_by_role": role,
        "doctor_id": payload.doctor_id,
        "doctor_name": payload.doctor_name,
        "hospital_id": payload.hospital_id,
        "hospital_name": payload.hospital_name,
        "appointment_id": payload.appointment_id,
        "consultation_id": payload.consultation_id,
        "referral_id": payload.referral_id,
        "medical_record_id": payload.medical_record_id,
        "medical_record_ids": payload.medical_record_ids or ([] if not payload.medical_record_id else [payload.medical_record_id]),
        "follow_up_type": tp,
        "title": payload.title.strip(),
        "description": (payload.description or "").strip(),
        "purpose": (payload.purpose or payload.description or payload.title).strip(),
        "doctor_instructions": (payload.doctor_instructions or "").strip(),
        "doctor_notes": (payload.doctor_notes or "").strip(),
        "treatment_name": payload.treatment_name,
        "recommended_department": payload.recommended_department,
        "due_date": payload.due_date,
        "due_time": payload.due_time or "10:00",
        "status": init_status,
        "priority": pr,
        "is_online": payload.is_online if payload.is_online is not None else True,
        "reminder_enabled": payload.reminder_enabled,
        "reminder_days_before": payload.reminder_days_before,
        "completed_at": None,
        "completed_by": None,
        "completion_notes": None,
        "created_at": time.time(),
        "updated_at": time.time()
    }

    await follow_ups_collection.insert_one(doc)

    await log_audit_event(
        user_email=user_email,
        role=role,
        action="FOLLOW_UP_CREATED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"title": payload.title, "due_date": payload.due_date, "type": tp, "priority": pr, "status": init_status}
    )

    # Emit notification to patient if created by doctor
    if role in ["doctor", "hospital"] and target_patient != user_email:
        notif_doc = {
            "recipient_email": target_patient,
            "recipient_role": "patient",
            "title": f"Follow-Up Request from Dr. {payload.doctor_name or 'Your Doctor'}",
            "message": f"Dr. {payload.doctor_name or 'Your doctor'} created a follow-up request on {payload.due_date} at {payload.due_time or '10:00'}. Reason: {payload.purpose or payload.title}.",
            "type": "FOLLOW_UP_REQUEST",
            "follow_up_id": follow_up_id,
            "scheduled_date": payload.due_date,
            "timestamp": time.time(),
            "read": False
        }
        await notifications_collection.insert_one(notif_doc)

    formatted = format_follow_up_doc(doc)
    if formatted["status"] == "DUE_TODAY" and payload.reminder_enabled:
        await send_followup_reminder(
            patient_email=target_patient,
            follow_up_id=follow_up_id,
            title=payload.title,
            reminder_type="DUE_TODAY",
            due_date_str=payload.due_date
        )

    return formatted


@router.get("/{follow_up_id}")
async def get_followup_detail(
    follow_up_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single follow-up detail by ID."""
    doc = await follow_ups_collection.find_one({
        "$or": [
            {"follow_up_id": follow_up_id},
            {"_id": follow_up_id}
        ]
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    if not await verify_authorization(current_user, target_patient, doctor_id=doc.get("doctor_id"), hospital_id=doc.get("hospital_id")):
        raise HTTPException(status_code=403, detail="Unauthorized access to follow-up record")

    await log_audit_event(
        user_email=current_user.get("sub", ""),
        role=current_user.get("role", "patient"),
        action="FOLLOW_UP_VIEWED",
        patient_id=target_patient,
        follow_up_id=doc.get("follow_up_id"),
        details={"viewed_at": time.time()}
    )

    return format_follow_up_doc(doc)


@router.patch("/{follow_up_id}/accept")
@router.post("/{follow_up_id}/accept")
async def accept_followup(
    follow_up_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Patient accepts proposed follow-up request."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Unauthorized attempt to accept follow-up")

    now = time.time()
    updates = {
        "status": "CONFIRMED",
        "updated_at": now
    }
    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    # Notify doctor
    doctor_target = doc.get("created_by") or doc.get("doctor_id")
    if doctor_target:
        notif = {
            "recipient_email": doctor_target,
            "recipient_role": "doctor",
            "title": f"Follow-Up Request Accepted",
            "message": f"Patient {target_patient} accepted follow-up '{doc.get('title')}' for {doc.get('due_date')} at {doc.get('due_time')}.",
            "type": "FOLLOW_UP_ACCEPTED",
            "follow_up_id": follow_up_id,
            "timestamp": now,
            "read": False
        }
        await notifications_collection.insert_one(notif)

    await log_audit_event(
        user_email=user_email,
        role="patient",
        action="FOLLOW_UP_ACCEPTED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"confirmed_date": doc.get("due_date"), "confirmed_time": doc.get("due_time")}
    )

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    return format_follow_up_doc(updated_doc)


@router.post("/{follow_up_id}/change-request")
async def request_followup_change(
    follow_up_id: str,
    payload: FollowUpChangeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Patient proposes alternative date/time for follow-up."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Unauthorized request")

    now = time.time()
    change_data = {
        "requested_date": payload.requested_date,
        "requested_time": payload.requested_time or "10:00",
        "message": payload.message or "",
        "requested_at": now
    }

    updates = {
        "status": "CHANGE_REQUESTED",
        "change_request": change_data,
        "updated_at": now
    }
    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    # Notify doctor
    doc_target = doc.get("created_by") or doc.get("doctor_id")
    if doc_target:
        notif = {
            "recipient_email": doc_target,
            "recipient_role": "doctor",
            "title": "Follow-Up Time Change Requested",
            "message": f"Patient {target_patient} requested time change for '{doc.get('title')}' to {payload.requested_date} at {payload.requested_time}.",
            "type": "FOLLOW_UP_CHANGE_REQUEST",
            "follow_up_id": follow_up_id,
            "timestamp": now,
            "read": False
        }
        await notifications_collection.insert_one(notif)

    await log_audit_event(
        user_email=user_email,
        role="patient",
        action="FOLLOW_UP_CHANGE_REQUESTED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details=change_data
    )

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    return format_follow_up_doc(updated_doc)


@router.patch("/{follow_up_id}/change-request/approve")
@router.post("/{follow_up_id}/change-request/approve")
async def approve_followup_change(
    follow_up_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Doctor approves patient's requested date/time change."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    if not await verify_authorization(current_user, target_patient, doctor_id=doc.get("doctor_id"), hospital_id=doc.get("hospital_id")):
        raise HTTPException(status_code=403, detail="Unauthorized action")

    change_req = doc.get("change_request", {})
    new_date = change_req.get("requested_date") or doc.get("due_date")
    new_time = change_req.get("requested_time") or doc.get("due_time", "10:00")

    now = time.time()
    updates = {
        "due_date": new_date,
        "due_time": new_time,
        "status": "CONFIRMED",
        "change_request": None,
        "updated_at": now
    }
    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    # Notify patient
    notif = {
        "recipient_email": target_patient,
        "recipient_role": "patient",
        "title": "Follow-Up Rescheduled & Confirmed",
        "message": f"Your doctor approved your requested time change. Your follow-up '{doc.get('title')}' is confirmed for {new_date} at {new_time}.",
        "type": "FOLLOW_UP_CONFIRMED",
        "follow_up_id": follow_up_id,
        "timestamp": now,
        "read": False
    }
    await notifications_collection.insert_one(notif)

    await log_audit_event(
        user_email=user_email,
        role=current_user.get("role", "doctor"),
        action="FOLLOW_UP_CHANGE_APPROVED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"approved_date": new_date, "approved_time": new_time}
    )

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    return format_follow_up_doc(updated_doc)


@router.patch("/{follow_up_id}/change-request/reject")
@router.post("/{follow_up_id}/change-request/reject")
async def reject_followup_change(
    follow_up_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Doctor rejects requested time change."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    if not await verify_authorization(current_user, target_patient, doctor_id=doc.get("doctor_id"), hospital_id=doc.get("hospital_id")):
        raise HTTPException(status_code=403, detail="Unauthorized action")

    now = time.time()
    updates = {
        "status": "PENDING_PATIENT",
        "change_request": None,
        "updated_at": now
    }
    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    # Notify patient
    notif = {
        "recipient_email": target_patient,
        "recipient_role": "patient",
        "title": "Follow-Up Change Request Declined",
        "message": f"Your doctor was unable to accommodate the requested time change. The follow-up remains set for {doc.get('due_date')} at {doc.get('due_time')}.",
        "type": "FOLLOW_UP_RESCHEDULED",
        "follow_up_id": follow_up_id,
        "timestamp": now,
        "read": False
    }
    await notifications_collection.insert_one(notif)

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    return format_follow_up_doc(updated_doc)


@router.patch("/{follow_up_id}/decline")
@router.post("/{follow_up_id}/decline")
async def decline_followup(
    follow_up_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Patient declines proposed follow-up request."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Unauthorized action")

    now = time.time()
    updates = {
        "status": "DECLINED",
        "updated_at": now
    }
    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    # Notify doctor
    doc_target = doc.get("created_by") or doc.get("doctor_id")
    if doc_target:
        notif = {
            "recipient_email": doc_target,
            "recipient_role": "doctor",
            "title": "Follow-Up Declined by Patient",
            "message": f"Patient {target_patient} declined follow-up request '{doc.get('title')}'.",
            "type": "FOLLOW_UP_CANCELLED",
            "follow_up_id": follow_up_id,
            "timestamp": now,
            "read": False
        }
        await notifications_collection.insert_one(notif)

    await log_audit_event(
        user_email=user_email,
        role="patient",
        action="FOLLOW_UP_DECLINED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"declined_at": now}
    )

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    return format_follow_up_doc(updated_doc)


@router.put("/{follow_up_id}")
async def update_followup(
    follow_up_id: str,
    payload: FollowUpUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update follow-up record fields."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    if not await verify_authorization(current_user, target_patient, doctor_id=doc.get("doctor_id"), hospital_id=doc.get("hospital_id")):
        raise HTTPException(status_code=403, detail="Unauthorized modification attempt")

    updates: Dict[str, Any] = {"updated_at": time.time()}

    if payload.title is not None:
        updates["title"] = payload.title.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.due_date is not None:
        updates["due_date"] = payload.due_date
        if doc.get("status") not in ["COMPLETED", "CANCELLED", "DECLINED"]:
            updates["status"] = compute_followup_status(payload.due_date)
    if payload.due_time is not None:
        updates["due_time"] = payload.due_time
    if payload.priority is not None and payload.priority.upper() in VALID_PRIORITIES:
        updates["priority"] = payload.priority.upper()
    if payload.reminder_enabled is not None:
        updates["reminder_enabled"] = payload.reminder_enabled
    if payload.reminder_days_before is not None:
        updates["reminder_days_before"] = payload.reminder_days_before
    if payload.medical_record_id is not None:
        updates["medical_record_id"] = payload.medical_record_id
    if payload.medical_record_ids is not None:
        updates["medical_record_ids"] = payload.medical_record_ids
    if payload.referral_id is not None:
        updates["referral_id"] = payload.referral_id
    if payload.purpose is not None:
        updates["purpose"] = payload.purpose
    if payload.doctor_instructions is not None:
        updates["doctor_instructions"] = payload.doctor_instructions

    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    await log_audit_event(
        user_email=current_user.get("sub", ""),
        role=current_user.get("role", "patient"),
        action="FOLLOW_UP_UPDATED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"updates": updates}
    )

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    return format_follow_up_doc(updated_doc)


@router.delete("/{follow_up_id}")
async def delete_followup(
    follow_up_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete follow-up record with strict ownership verification."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    role = current_user.get("role", "patient")

    if role not in ["admin", "doctor", "hospital"] and doc.get("created_by") != user_email:
        raise HTTPException(status_code=403, detail="Unauthorized deletion request")

    await follow_ups_collection.delete_one({"follow_up_id": follow_up_id})

    await log_audit_event(
        user_email=user_email,
        role=role,
        action="FOLLOW_UP_DELETED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"deleted_at": time.time()}
    )

    return {"message": f"Follow-up {follow_up_id} deleted successfully."}


@router.post("/{follow_up_id}/complete")
async def complete_followup(
    follow_up_id: str,
    payload: FollowUpComplete,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark follow-up completed with outcome notes, doctor notes, and continuous care cycle creation.
    """
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    role = current_user.get("role", "patient")

    if not await verify_authorization(current_user, target_patient, doctor_id=doc.get("doctor_id"), hospital_id=doc.get("hospital_id")):
        raise HTTPException(status_code=403, detail="Unauthorized completion request")

    follow_up_type = doc.get("follow_up_type", "ROUTINE_CHECKUP")
    if role == "patient" and follow_up_type in CLINICAL_VERIFICATION_TYPES and doc.get("created_by_role") in ["doctor", "hospital"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Follow-up type '{follow_up_type}' requires healthcare-worker confirmation to mark complete."
        )

    now = time.time()
    updates = {
        "status": "COMPLETED",
        "completed_at": now,
        "completed_by": user_email,
        "completion_notes": payload.completion_notes or "Marked complete.",
        "outcome": payload.outcome or payload.completion_notes or "Completed successfully",
        "doctor_notes": payload.doctor_notes or doc.get("doctor_notes", ""),
        "treatment_progress": payload.treatment_progress,
        "referral_required": payload.referral_required or False,
        "updated_at": now
    }

    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    await log_audit_event(
        user_email=user_email,
        role=role,
        action="FOLLOW_UP_COMPLETED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"completion_notes": payload.completion_notes, "outcome": payload.outcome}
    )

    # Notify patient
    notif = {
        "recipient_email": target_patient,
        "recipient_role": "patient",
        "title": "Follow-Up Completed",
        "message": f"Your follow-up '{doc.get('title')}' has been marked completed by Dr. {doc.get('doctor_name') or 'your doctor'}.",
        "type": "FOLLOW_UP_COMPLETED",
        "follow_up_id": follow_up_id,
        "timestamp": now,
        "read": False
    }
    await notifications_collection.insert_one(notif)

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    res = format_follow_up_doc(updated_doc)

    if payload.create_next_follow_up:
        next_due = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")
        next_id = f"FLP-{uuid.uuid4().hex[:8].upper()}"
        next_doc = {
            "follow_up_id": next_id,
            "patient_id": target_patient,
            "created_by": user_email,
            "created_by_role": role,
            "doctor_id": doc.get("doctor_id"),
            "doctor_name": doc.get("doctor_name"),
            "hospital_id": doc.get("hospital_id"),
            "hospital_name": doc.get("hospital_name"),
            "original_appointment_id": doc.get("appointment_id") or doc.get("follow_up_id"),
            "follow_up_type": doc.get("follow_up_type"),
            "title": f"Follow-Up: {doc.get('title')}",
            "description": f"Next continuous care follow-up following completion of {follow_up_id}",
            "purpose": "Continuous Care Monitoring",
            "due_date": next_due,
            "due_time": "10:00",
            "status": "PENDING_PATIENT" if role in ["doctor", "hospital"] else "CONFIRMED",
            "priority": doc.get("priority", "NORMAL"),
            "reminder_enabled": True,
            "reminder_days_before": 1,
            "created_at": now,
            "updated_at": now
        }
        await follow_ups_collection.insert_one(next_doc)
        res["next_follow_up"] = format_follow_up_doc(next_doc)

    return res


@router.post("/{follow_up_id}/cancel")
async def cancel_followup(
    follow_up_id: str,
    payload: FollowUpCancel,
    current_user: dict = Depends(get_current_user)
):
    """Cancel follow-up record."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    role = current_user.get("role", "patient")

    if not await verify_authorization(current_user, target_patient, doctor_id=doc.get("doctor_id"), hospital_id=doc.get("hospital_id")):
        raise HTTPException(status_code=403, detail="Unauthorized cancellation request")

    now = time.time()
    updates = {
        "status": "CANCELLED",
        "completion_notes": f"Cancelled: {payload.reason or 'User cancelled.'}",
        "updated_at": now
    }

    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    await log_audit_event(
        user_email=user_email,
        role=role,
        action="FOLLOW_UP_CANCELLED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"reason": payload.reason}
    )

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    return format_follow_up_doc(updated_doc)


@router.post("/{follow_up_id}/reschedule")
async def reschedule_followup(
    follow_up_id: str,
    payload: FollowUpReschedule,
    current_user: dict = Depends(get_current_user)
):
    """Reschedule follow-up record to new due date and time."""
    doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Follow-up record not found")

    target_patient = doc.get("patient_id")
    user_email = current_user.get("sub", "")
    role = current_user.get("role", "patient")

    if not await verify_authorization(current_user, target_patient, doctor_id=doc.get("doctor_id"), hospital_id=doc.get("hospital_id")):
        raise HTTPException(status_code=403, detail="Unauthorized rescheduling request")

    new_status = compute_followup_status(payload.new_due_date)
    now = time.time()

    updates = {
        "due_date": payload.new_due_date,
        "due_time": payload.new_due_time or doc.get("due_time", "10:00"),
        "status": new_status,
        "updated_at": now
    }

    await follow_ups_collection.update_one({"follow_up_id": follow_up_id}, {"$set": updates})

    await log_audit_event(
        user_email=user_email,
        role=role,
        action="FOLLOW_UP_RESCHEDULED",
        patient_id=target_patient,
        follow_up_id=follow_up_id,
        details={"old_due_date": doc.get("due_date"), "new_due_date": payload.new_due_date, "reason": payload.reason}
    )

    updated_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
    return format_follow_up_doc(updated_doc)

