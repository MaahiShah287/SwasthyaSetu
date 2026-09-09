from fastapi import APIRouter, HTTPException, Depends, Query, Body, Response
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time
from datetime import datetime, date, timedelta
from bson import ObjectId
import json

from database import (
    vaccinations_collection,
    vaccine_schedules_collection,
    audit_logs_collection,
    notifications_collection,
    consultations_collection,
    appointments_collection,
    hospital_bookings_collection,
    doctors_collection,
    healthcare_facilities_collection,
    reports_collection,
    children_collection,
    vaccination_records_collection,
    vaccination_reminders_collection
)
from utils.jwt_handler import get_current_user
from services.ai_service import AIService

router = APIRouter()

# -----------------------------------------------------------------------------
# Standard Verified Reference Schedules (WHO / IAP Guidelines)
# -----------------------------------------------------------------------------
STANDARD_VACCINE_SCHEDULES = [
    {
        "schedule_id": "SCH-BCG-01",
        "vaccine_name": "BCG (Tuberculosis)",
        "vaccine_code": "CVX-05",
        "dose_number": 1,
        "recommended_interval": "At Birth",
        "age_group": "Infant (Birth)",
        "special_population": "All Newborns",
        "source": "WHO / IAP National Immunization Schedule",
        "source_version": "2026.1",
        "effective_date": "2026-01-01"
    },
    {
        "schedule_id": "SCH-HEPB-01",
        "vaccine_name": "Hepatitis B",
        "vaccine_code": "CVX-45",
        "dose_number": 1,
        "recommended_interval": "At Birth",
        "age_group": "Infant (Birth)",
        "special_population": "All Newborns",
        "source": "WHO / IAP National Immunization Schedule",
        "source_version": "2026.1",
        "effective_date": "2026-01-01"
    },
    {
        "schedule_id": "SCH-HEPB-02",
        "vaccine_name": "Hepatitis B",
        "vaccine_code": "CVX-45",
        "dose_number": 2,
        "recommended_interval": "1 Month",
        "age_group": "Infant (1 Month)",
        "special_population": "Infants",
        "source": "WHO / IAP National Immunization Schedule",
        "source_version": "2026.1",
        "effective_date": "2026-01-01"
    },
    {
        "schedule_id": "SCH-DTP-01",
        "vaccine_name": "DTP / DTaP (Diphtheria, Tetanus, Pertussis)",
        "vaccine_code": "CVX-20",
        "dose_number": 1,
        "recommended_interval": "6 Weeks",
        "age_group": "Infant (6 Weeks)",
        "special_population": "Infants",
        "source": "WHO / IAP National Immunization Schedule",
        "source_version": "2026.1",
        "effective_date": "2026-01-01"
    },
    {
        "schedule_id": "SCH-MMR-01",
        "vaccine_name": "MMR (Measles, Mumps, Rubella)",
        "vaccine_code": "CVX-03",
        "dose_number": 1,
        "recommended_interval": "9 Months",
        "age_group": "Infant (9 Months)",
        "special_population": "Infants",
        "source": "WHO / IAP National Immunization Schedule",
        "source_version": "2026.1",
        "effective_date": "2026-01-01"
    },
    {
        "schedule_id": "SCH-MMR-02",
        "vaccine_name": "MMR (Measles, Mumps, Rubella)",
        "vaccine_code": "CVX-03",
        "dose_number": 2,
        "recommended_interval": "15 Months",
        "age_group": "Child (15 Months)",
        "special_population": "Toddlers",
        "source": "WHO / IAP National Immunization Schedule",
        "source_version": "2026.1",
        "effective_date": "2026-01-01"
    },
    {
        "schedule_id": "SCH-COV-01",
        "vaccine_name": "COVID-19 Booster",
        "vaccine_code": "CVX-213",
        "dose_number": 3,
        "recommended_interval": "Annual / 12 Months",
        "age_group": "Adult / High Risk",
        "special_population": "General Population & High Risk",
        "source": "WHO / Ministry of Health Guidelines",
        "source_version": "2026.1",
        "effective_date": "2026-01-01"
    },
    {
        "schedule_id": "SCH-FLU-01",
        "vaccine_name": "Influenza (Seasonal Flu)",
        "vaccine_code": "CVX-141",
        "dose_number": 1,
        "recommended_interval": "Annual",
        "age_group": "All Ages (>6 Months)",
        "special_population": "General Population",
        "source": "WHO Annual Flu Advisory",
        "source_version": "2026.1",
        "effective_date": "2026-01-01"
    }
]

# -----------------------------------------------------------------------------
# Data Models
# -----------------------------------------------------------------------------
class VaccinationCreateRequest(BaseModel):
    vaccine_name: str
    vaccine_code: Optional[str] = None
    dose_number: int = Field(default=1, ge=1)
    dose_label: Optional[str] = None
    vaccination_date: str  # YYYY-MM-DD
    next_due_date: Optional[str] = None  # YYYY-MM-DD
    is_completed: bool = True
    notes: Optional[str] = None
    provider_name: Optional[str] = None
    provider_type: Optional[str] = "Clinic / Hospital"
    facility_name: Optional[str] = None
    facility_id: Optional[str] = None
    document_reference: Optional[str] = None
    reminder_enabled: bool = True
    reminder_days_before: int = 7

class VaccinationUpdateRequest(BaseModel):
    vaccine_name: Optional[str] = None
    vaccine_code: Optional[str] = None
    dose_number: Optional[int] = Field(default=None, ge=1)
    dose_label: Optional[str] = None
    vaccination_date: Optional[str] = None
    next_due_date: Optional[str] = None
    is_completed: Optional[bool] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    provider_name: Optional[str] = None
    provider_type: Optional[str] = None
    facility_name: Optional[str] = None
    facility_id: Optional[str] = None
    document_reference: Optional[str] = None
    reminder_enabled: Optional[bool] = None
    reminder_days_before: Optional[int] = None
    verified: Optional[bool] = None

class ChildCreateRequest(BaseModel):
    name: str
    date_of_birth: str  # YYYY-MM-DD
    gender: Optional[str] = "unspecified"
    location: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    is_je_endemic: Optional[bool] = False

class ChildUpdateRequest(BaseModel):
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    is_je_endemic: Optional[bool] = None

class ChildVaccinationRecordCreate(BaseModel):
    vaccine_id: str
    vaccine_name: str
    administered_date: str  # YYYY-MM-DD
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    notes: Optional[str] = None
    dose: Optional[str] = None

class ChildVaccinationRecordUpdate(BaseModel):
    administered_date: Optional[str] = None
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    notes: Optional[str] = None
    dose: Optional[str] = None
    status: Optional[str] = None

class ChildReminderCreate(BaseModel):
    child_id: str
    vaccine_id: str
    vaccine_name: str
    reminder_date: Optional[str] = None

class AIExplainRequest(BaseModel):
    vaccine_name: str
    question: Optional[str] = None
    child_age: Optional[str] = None

# -----------------------------------------------------------------------------
# Government of India National Immunization Schedule (NIS) Definition
# Source of truth: Ministry of Health and Family Welfare (MoHFW) / Universal Immunization Programme
# -----------------------------------------------------------------------------
NIS_SCHEDULE_DEFINITION = [
    {
        "milestone_id": "AT_BIRTH",
        "milestone_label": "At Birth",
        "min_offset_days": 0,
        "max_offset_days": 14,
        "vaccines": [
            {
                "vaccine_id": "BCG",
                "vaccine_name": "BCG",
                "full_name": "Bacillus Calmette–Guérin (Tuberculosis)",
                "dose": "0.05 ml (ID)",
                "route": "Intradermal",
                "recommended_age": "At Birth (or up to 1 year)",
                "min_offset_days": 0,
                "max_offset_days": 14
            },
            {
                "vaccine_id": "OPV_0",
                "vaccine_name": "bOPV-0",
                "full_name": "Bivalent Oral Polio Vaccine Birth Dose",
                "dose": "2 drops",
                "route": "Oral",
                "recommended_age": "At Birth (first 15 days)",
                "min_offset_days": 0,
                "max_offset_days": 14
            },
            {
                "vaccine_id": "HEPB_0",
                "vaccine_name": "Hepatitis B Birth Dose",
                "full_name": "Hepatitis B Vaccine Birth Dose",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "At Birth (within 24 hours)",
                "min_offset_days": 0,
                "max_offset_days": 1
            }
        ]
    },
    {
        "milestone_id": "6_WEEKS",
        "milestone_label": "6 Weeks",
        "min_offset_days": 42,
        "max_offset_days": 55,
        "vaccines": [
            {
                "vaccine_id": "OPV_1",
                "vaccine_name": "bOPV-1",
                "full_name": "Bivalent Oral Polio Vaccine Dose 1",
                "dose": "2 drops",
                "route": "Oral",
                "recommended_age": "6 Weeks",
                "min_offset_days": 42,
                "max_offset_days": 55
            },
            {
                "vaccine_id": "PENTA_1",
                "vaccine_name": "Pentavalent-1",
                "full_name": "Pentavalent Vaccine Dose 1 (DPT + Hep B + Hib)",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "6 Weeks",
                "min_offset_days": 42,
                "max_offset_days": 55
            },
            {
                "vaccine_id": "FIPV_1",
                "vaccine_name": "fIPV-1",
                "full_name": "Fractional Inactivated Polio Vaccine Dose 1",
                "dose": "0.1 ml (ID)",
                "route": "Intradermal",
                "recommended_age": "6 Weeks",
                "min_offset_days": 42,
                "max_offset_days": 55
            },
            {
                "vaccine_id": "RVV_1",
                "vaccine_name": "RVV-1",
                "full_name": "Rotavirus Vaccine Dose 1",
                "dose": "5 drops",
                "route": "Oral",
                "recommended_age": "6 Weeks",
                "min_offset_days": 42,
                "max_offset_days": 55
            },
            {
                "vaccine_id": "PCV_1",
                "vaccine_name": "PCV-1",
                "full_name": "Pneumococcal Conjugate Vaccine Dose 1",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "6 Weeks",
                "min_offset_days": 42,
                "max_offset_days": 55
            }
        ]
    },
    {
        "milestone_id": "10_WEEKS",
        "milestone_label": "10 Weeks",
        "min_offset_days": 70,
        "max_offset_days": 83,
        "vaccines": [
            {
                "vaccine_id": "OPV_2",
                "vaccine_name": "bOPV-2",
                "full_name": "Bivalent Oral Polio Vaccine Dose 2",
                "dose": "2 drops",
                "route": "Oral",
                "recommended_age": "10 Weeks",
                "min_offset_days": 70,
                "max_offset_days": 83
            },
            {
                "vaccine_id": "PENTA_2",
                "vaccine_name": "Pentavalent-2",
                "full_name": "Pentavalent Vaccine Dose 2",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "10 Weeks",
                "min_offset_days": 70,
                "max_offset_days": 83
            },
            {
                "vaccine_id": "RVV_2",
                "vaccine_name": "RVV-2",
                "full_name": "Rotavirus Vaccine Dose 2",
                "dose": "5 drops",
                "route": "Oral",
                "recommended_age": "10 Weeks",
                "min_offset_days": 70,
                "max_offset_days": 83
            }
        ]
    },
    {
        "milestone_id": "14_WEEKS",
        "milestone_label": "14 Weeks",
        "min_offset_days": 98,
        "max_offset_days": 111,
        "vaccines": [
            {
                "vaccine_id": "OPV_3",
                "vaccine_name": "bOPV-3",
                "full_name": "Bivalent Oral Polio Vaccine Dose 3",
                "dose": "2 drops",
                "route": "Oral",
                "recommended_age": "14 Weeks",
                "min_offset_days": 98,
                "max_offset_days": 111
            },
            {
                "vaccine_id": "PENTA_3",
                "vaccine_name": "Pentavalent-3",
                "full_name": "Pentavalent Vaccine Dose 3",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "14 Weeks",
                "min_offset_days": 98,
                "max_offset_days": 111
            },
            {
                "vaccine_id": "FIPV_2",
                "vaccine_name": "fIPV-2",
                "full_name": "Fractional Inactivated Polio Vaccine Dose 2",
                "dose": "0.1 ml (ID)",
                "route": "Intradermal",
                "recommended_age": "14 Weeks",
                "min_offset_days": 98,
                "max_offset_days": 111
            },
            {
                "vaccine_id": "RVV_3",
                "vaccine_name": "RVV-3",
                "full_name": "Rotavirus Vaccine Dose 3",
                "dose": "5 drops",
                "route": "Oral",
                "recommended_age": "14 Weeks",
                "min_offset_days": 98,
                "max_offset_days": 111
            },
            {
                "vaccine_id": "PCV_2",
                "vaccine_name": "PCV-2",
                "full_name": "Pneumococcal Conjugate Vaccine Dose 2",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "14 Weeks",
                "min_offset_days": 98,
                "max_offset_days": 111
            }
        ]
    },
    {
        "milestone_id": "9-11_MONTHS",
        "milestone_label": "9–11 Months",
        "min_offset_days": 270,
        "max_offset_days": 330,
        "vaccines": [
            {
                "vaccine_id": "MR_1",
                "vaccine_name": "MR-1",
                "full_name": "Measles & Rubella Vaccine Dose 1",
                "dose": "0.5 ml (SC)",
                "route": "Subcutaneous",
                "recommended_age": "9–11 Months",
                "min_offset_days": 270,
                "max_offset_days": 330
            },
            {
                "vaccine_id": "JE_1",
                "vaccine_name": "JE-1",
                "full_name": "Japanese Encephalitis Dose 1",
                "dose": "0.5 ml (SC)",
                "route": "Subcutaneous",
                "recommended_age": "9–11 Months",
                "min_offset_days": 270,
                "max_offset_days": 330,
                "is_je_endemic_only": True
            },
            {
                "vaccine_id": "PCV_B",
                "vaccine_name": "PCV-Booster",
                "full_name": "Pneumococcal Conjugate Booster Dose",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "9–11 Months",
                "min_offset_days": 270,
                "max_offset_days": 330
            },
            {
                "vaccine_id": "FIPV_3",
                "vaccine_name": "fIPV-3",
                "full_name": "Fractional Inactivated Polio Vaccine Dose 3",
                "dose": "0.1 ml (ID)",
                "route": "Intradermal",
                "recommended_age": "9–11 Months",
                "min_offset_days": 270,
                "max_offset_days": 330
            },
            {
                "vaccine_id": "VITA_1",
                "vaccine_name": "Vitamin-A 1st dose",
                "full_name": "Vitamin A Liquid Supplement 1st Dose",
                "dose": "1 lakh IU (1 ml)",
                "route": "Oral",
                "recommended_age": "9–11 Months",
                "min_offset_days": 270,
                "max_offset_days": 330
            }
        ]
    },
    {
        "milestone_id": "16-23_MONTHS",
        "milestone_label": "16–23 Months",
        "min_offset_days": 480,
        "max_offset_days": 690,
        "vaccines": [
            {
                "vaccine_id": "MR_2",
                "vaccine_name": "MR-2",
                "full_name": "Measles & Rubella Vaccine Dose 2",
                "dose": "0.5 ml (SC)",
                "route": "Subcutaneous",
                "recommended_age": "16–23 Months",
                "min_offset_days": 480,
                "max_offset_days": 690
            },
            {
                "vaccine_id": "JE_2",
                "vaccine_name": "JE-2",
                "full_name": "Japanese Encephalitis Dose 2",
                "dose": "0.5 ml (SC)",
                "route": "Subcutaneous",
                "recommended_age": "16–23 Months",
                "min_offset_days": 480,
                "max_offset_days": 690,
                "is_je_endemic_only": True
            },
            {
                "vaccine_id": "DPT_B1",
                "vaccine_name": "DPT Booster-1",
                "full_name": "Diphtheria, Pertussis, Tetanus Booster 1",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "16–23 Months",
                "min_offset_days": 480,
                "max_offset_days": 690
            },
            {
                "vaccine_id": "OPV_B",
                "vaccine_name": "bOPV-Booster",
                "full_name": "Bivalent Oral Polio Vaccine Booster",
                "dose": "2 drops",
                "route": "Oral",
                "recommended_age": "16–23 Months",
                "min_offset_days": 480,
                "max_offset_days": 690
            },
            {
                "vaccine_id": "VITA_2",
                "vaccine_name": "Vitamin-A 2nd dose",
                "full_name": "Vitamin A Liquid Supplement 2nd Dose",
                "dose": "2 lakh IU (2 ml)",
                "route": "Oral",
                "recommended_age": "16–23 Months",
                "min_offset_days": 480,
                "max_offset_days": 690
            }
        ]
    },
    {
        "milestone_id": "5-6_YEARS",
        "milestone_label": "5–6 Years",
        "min_offset_days": 1825,
        "max_offset_days": 2190,
        "vaccines": [
            {
                "vaccine_id": "DPT_B2",
                "vaccine_name": "DPT Booster-2",
                "full_name": "Diphtheria, Pertussis, Tetanus Booster 2",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "5–6 Years",
                "min_offset_days": 1825,
                "max_offset_days": 2190
            }
        ]
    },
    {
        "milestone_id": "10_YEARS",
        "milestone_label": "10 Years",
        "min_offset_days": 3650,
        "max_offset_days": 3830,
        "vaccines": [
            {
                "vaccine_id": "TD_10",
                "vaccine_name": "Td",
                "full_name": "Tetanus & Adult Diphtheria (10 Years)",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "10 Years",
                "min_offset_days": 3650,
                "max_offset_days": 3830
            }
        ]
    },
    {
        "milestone_id": "16_YEARS",
        "milestone_label": "16 Years",
        "min_offset_days": 5840,
        "max_offset_days": 6020,
        "vaccines": [
            {
                "vaccine_id": "TD_16",
                "vaccine_name": "Td",
                "full_name": "Tetanus & Adult Diphtheria (16 Years)",
                "dose": "0.5 ml (IM)",
                "route": "Intramuscular",
                "recommended_age": "16 Years",
                "min_offset_days": 5840,
                "max_offset_days": 6020
            }
        ]
    }
]

def calculate_child_age(dob_str: Optional[str]) -> Dict[str, Any]:
    """Calculate exact age breakdown (days, weeks, months, years) and formatted display string."""
    dob = parse_date(dob_str)
    if not dob:
        return {"formatted": "Unknown Age", "is_newborn": False, "days": 0, "weeks": 0, "months": 0, "years": 0}
    
    today = date.today()
    days = (today - dob).days
    if days < 0:
        days = 0
    weeks = days // 7
    months = days // 30
    years = days // 365
    
    is_newborn = days <= 14
    if is_newborn:
        formatted = "Newborn" if days <= 1 else f"Newborn ({days} days)"
    elif days < 60:
        formatted = f"{weeks} Weeks" if weeks > 1 else f"{days} Days"
    elif months < 24:
        formatted = f"{months} Months"
    else:
        formatted = f"{years} Years"
        
    return {
        "formatted": formatted,
        "is_newborn": is_newborn,
        "days": days,
        "weeks": weeks,
        "months": months,
        "years": years
    }

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
def parse_date(date_str: Optional[str]) -> Optional[date]:
    if not date_str or date_str in ["Not Set", "None", "null", ""]:
        return None
    try:
        if "T" in date_str:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00")).date()
        return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except Exception:
        return None

def compute_backend_status(
    vaccination_date_str: str,
    next_due_date_str: Optional[str],
    is_completed: bool = True,
    explicit_status: Optional[str] = None
) -> str:
    """
    BACKEND STATUS ENGINE
    Determines status deterministically:
    COMPLETED, UPCOMING, DUE_SOON, OVERDUE, MISSED
    """
    if explicit_status in ["COMPLETED", "UPCOMING", "DUE_SOON", "OVERDUE", "MISSED"] and not is_completed:
        return explicit_status

    today = date.today()
    v_date = parse_date(vaccination_date_str)
    nd_date = parse_date(next_due_date_str)

    # If is_completed is True
    if is_completed:
        if not nd_date:
            return "COMPLETED"
        # If there is a next due date
        days_diff = (nd_date - today).days
        if days_diff < 0:
            if days_diff < -30:
                return "MISSED"
            return "OVERDUE"
        elif days_diff <= 7:
            return "DUE_SOON"
        else:
            return "COMPLETED"

    # If is_completed is False (planned or pending dose)
    target_date = nd_date or v_date or today
    days_diff = (target_date - today).days

    if days_diff > 7:
        return "UPCOMING"
    elif 0 <= days_diff <= 7:
        return "DUE_SOON"
    elif -30 <= days_diff < 0:
        return "OVERDUE"
    else:
        return "MISSED"

async def log_audit_event(
    user_email: str,
    role: str,
    action: str,
    patient_id: str,
    record_id: str,
    details: Dict[str, Any]
):
    """Integrate with Clinical Audit engine."""
    audit_entry = {
        "user": user_email,
        "role": role,
        "action": action,
        "patient_id": patient_id,
        "record_id": str(record_id),
        "timestamp": time.time(),
        "details": details
    }
    try:
        await audit_logs_collection.insert_one(audit_entry)
    except Exception as e:
        print(f"Audit log insertion error: {e}")

async def send_smart_reminder(
    patient_email: str,
    vaccination_id: str,
    vaccine_name: str,
    status: str,
    due_date_str: Optional[str]
):
    """
    Reuse existing notification system with deterministic deduplication.
    """
    if status not in ["DUE_SOON", "OVERDUE", "MISSED", "UPCOMING"]:
        return

    # Check existing notification to prevent duplicate spam
    existing = await notifications_collection.find_one({
        "recipient_email": patient_email,
        "vaccination_id": vaccination_id,
        "reminder_type": status,
        "due_date": due_date_str
    })
    if existing:
        return

    title_map = {
        "DUE_SOON": f"Vaccination Due Soon: {vaccine_name}",
        "OVERDUE": f"Vaccination Overdue Alert: {vaccine_name}",
        "MISSED": f"Missed Immunization Alert: {vaccine_name}",
        "UPCOMING": f"Upcoming Vaccination Scheduled: {vaccine_name}"
    }
    msg_map = {
        "DUE_SOON": f"Your {vaccine_name} vaccination is due soon on {due_date_str or 'upcoming schedule'}. Please consult your provider.",
        "OVERDUE": f"Your {vaccine_name} vaccination was due on {due_date_str or 'past schedule'}. Please consult a doctor to reschedule.",
        "MISSED": f"Your {vaccine_name} immunization record is past due. Please review your immunization schedule.",
        "UPCOMING": f"Reminder: {vaccine_name} is scheduled for {due_date_str}."
    }

    notification_doc = {
        "recipient_email": patient_email,
        "recipient_role": "patient",
        "title": title_map.get(status, f"Vaccination Alert: {vaccine_name}"),
        "message": msg_map.get(status, f"Vaccination status update for {vaccine_name}."),
        "vaccination_id": vaccination_id,
        "reminder_type": status,
        "due_date": due_date_str,
        "timestamp": time.time(),
        "read": False
    }
    await notifications_collection.insert_one(notification_doc)

async def verify_authorization(current_user: dict, target_patient_id: str) -> bool:
    """
    Strict server-side authorization check.
    Patient: own records only.
    Doctor: authorized patient only (consultation/appointment relationship).
    Hospital: authorized patient/request relationship.
    Admin: allowed.
    """
    user_email = current_user["sub"]
    role = current_user.get("role", "patient")

    if role == "admin":
        return True

    if role == "patient":
        return user_email == target_patient_id

    if role == "doctor":
        doc = await doctors_collection.find_one({"email": user_email})
        doctor_id = doc.get("doctor_id") if doc else current_user.get("doctor_id")
        
        # Check if patient has any appointment/consultation with this doctor or email match
        has_appt = await appointments_collection.find_one({
            "$or": [
                {"doctor_email": user_email, "patient_email": target_patient_id},
                {"doctor_id": doctor_id, "patient_email": target_patient_id}
            ]
        })
        has_consult = await consultations_collection.find_one({
            "$or": [
                {"doctor_email": user_email, "patient_email": target_patient_id},
                {"doctor_id": doctor_id, "patient_email": target_patient_id}
            ]
        })
        return bool(has_appt or has_consult or user_email == target_patient_id)

    if role == "hospital":
        fac_id = current_user.get("facility_id")
        has_booking = await hospital_bookings_collection.find_one({
            "$or": [
                {"facility_id": fac_id, "patient_email": target_patient_id},
                {"hospital_email": user_email, "patient_email": target_patient_id}
            ]
        })
        return bool(has_booking or user_email == target_patient_id)

    return False

# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------

@router.get("/schedules")
async def get_vaccine_schedules():
    """Retrieve authoritative verified reference vaccination schedules."""
    # Check if custom DB schedules exist, else return standard
    cursor = vaccine_schedules_collection.find({}, {"_id": 0})
    custom_schedules = []
    async for s in cursor:
        custom_schedules.append(s)
    
    if custom_schedules:
        return custom_schedules
    return STANDARD_VACCINE_SCHEDULES


@router.get("/summary")
async def get_vaccination_summary(
    patient_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Get live backend summary metrics for Vaccination Status widget:
    Total, Completed, Upcoming, Due Soon, Overdue, Missed, Gaps.
    """
    target_patient = patient_id or current_user["sub"]
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized access to patient vaccination records.")

    cursor = vaccinations_collection.find({"patient_id": target_patient})
    records = []
    async for r in cursor:
        records.append(r)

    total = len(records)
    completed = 0
    upcoming = 0
    due_soon = 0
    overdue = 0
    missed = 0

    for r in records:
        status = compute_backend_status(
            r.get("vaccination_date", ""),
            r.get("next_due_date"),
            r.get("is_completed", True),
            r.get("status")
        )
        if status == "COMPLETED":
            completed += 1
        elif status == "UPCOMING":
            upcoming += 1
        elif status == "DUE_SOON":
            due_soon += 1
        elif status == "OVERDUE":
            overdue += 1
        elif status == "MISSED":
            missed += 1

    gaps_count = overdue + missed

    return {
        "patient_id": target_patient,
        "total": total,
        "completed": completed,
        "upcoming": upcoming,
        "due_soon": due_soon,
        "overdue": overdue,
        "missed": missed,
        "gaps": gaps_count
    }


@router.get("/gaps")
async def get_immunization_gaps(
    patient_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    IMMUNIZATION GAP ENGINE
    Detects overdue/missed vaccinations and schedule gaps.
    """
    target_patient = patient_id or current_user["sub"]
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized access to patient immunization gaps.")

    cursor = vaccinations_collection.find({"patient_id": target_patient})
    records = []
    async for r in cursor:
        records.append(r)

    gaps = []
    today = date.today()

    # 1. Gaps from existing patient records that are OVERDUE or MISSED
    for r in records:
        status = compute_backend_status(
            r.get("vaccination_date", ""),
            r.get("next_due_date"),
            r.get("is_completed", True),
            r.get("status")
        )
        if status in ["OVERDUE", "MISSED"]:
            nd_date = parse_date(r.get("next_due_date")) or parse_date(r.get("vaccination_date"))
            days_overdue = (today - nd_date).days if nd_date else 0

            gaps.append({
                "record_id": str(r["_id"]),
                "vaccine_name": r.get("vaccine_name"),
                "dose_number": r.get("dose_number", 1),
                "dose_label": r.get("dose_label") or f"Dose {r.get('dose_number', 1)}",
                "original_due_date": r.get("next_due_date") or r.get("vaccination_date"),
                "days_overdue": max(days_overdue, 1),
                "status": status,
                "source": r.get("record_source", "PATIENT_ENTERED"),
                "recommended_action": "Consult a qualified healthcare professional to confirm the appropriate next step."
            })

    return {
        "patient_id": target_patient,
        "gaps_count": len(gaps),
        "gaps": gaps,
        "disclaimer": "Safety Note: Always consult a registered medical professional before receiving vaccinations."
    }


@router.get("/upcoming")
async def get_upcoming_vaccinations(
    patient_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve upcoming and due soon vaccinations sorted by nearest due date.
    """
    target_patient = patient_id or current_user["sub"]
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized access to upcoming vaccinations.")

    cursor = vaccinations_collection.find({"patient_id": target_patient})
    records = []
    async for r in cursor:
        records.append(r)

    upcoming_list = []
    today = date.today()

    for r in records:
        status = compute_backend_status(
            r.get("vaccination_date", ""),
            r.get("next_due_date"),
            r.get("is_completed", True),
            r.get("status")
        )
        if status in ["UPCOMING", "DUE_SOON", "OVERDUE"]:
            nd_date = parse_date(r.get("next_due_date")) or parse_date(r.get("vaccination_date"))
            days_remaining = (nd_date - today).days if nd_date else 0

            badge_text = "DUE TODAY" if days_remaining == 0 else (
                f"OVERDUE BY {abs(days_remaining)} DAYS" if days_remaining < 0 else f"DUE IN {days_remaining} DAYS"
            )

            upcoming_list.append({
                "id": str(r["_id"]),
                "vaccine_name": r.get("vaccine_name"),
                "dose_number": r.get("dose_number", 1),
                "dose_label": r.get("dose_label") or f"Dose {r.get('dose_number', 1)}",
                "due_date": r.get("next_due_date") or r.get("vaccination_date"),
                "days_remaining": days_remaining,
                "badge_text": badge_text,
                "status": status,
                "reminder_enabled": r.get("reminder_enabled", True),
                "provider_name": r.get("provider_name") or "Facility information unavailable."
            })

    # Sort by nearest due date (lowest days_remaining)
    upcoming_list.sort(key=lambda x: x["days_remaining"])
    return upcoming_list


@router.get("/")
async def list_vaccinations(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("newest"),  # newest, oldest, nearest_due, overdue_first
    current_user: dict = Depends(get_current_user)
):
    """
    List patient vaccination records with filtering, searching, and sorting.
    """
    target_patient = patient_id or current_user["sub"]
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized access to vaccination records.")

    query: Dict[str, Any] = {"patient_id": target_patient}
    if search:
        query["vaccine_name"] = {"$regex": search, "$options": "i"}

    cursor = vaccinations_collection.find(query)
    results = []
    async for r in cursor:
        r["id"] = str(r["_id"])
        r["_id"] = str(r["_id"])
        
        # Recalculate status dynamically for accuracy
        computed_status = compute_backend_status(
            r.get("vaccination_date", ""),
            r.get("next_due_date"),
            r.get("is_completed", True),
            r.get("status")
        )
        r["computed_status"] = computed_status
        r["status"] = computed_status

        # Filter status if requested
        if status and status.upper() != "ALL":
            if computed_status.upper() != status.upper():
                continue

        results.append(r)

    # Sorting
    if sort_by == "oldest":
        results.sort(key=lambda x: x.get("vaccination_date", ""))
    elif sort_by == "nearest_due":
        results.sort(key=lambda x: x.get("next_due_date") or "9999-12-31")
    elif sort_by == "overdue_first":
        def overdue_key(x):
            return 0 if x.get("status") in ["OVERDUE", "MISSED"] else 1
        results.sort(key=overdue_key)
    else:  # newest (default)
        results.sort(key=lambda x: x.get("vaccination_date", ""), reverse=True)

    return results


@router.post("/")
async def create_vaccination(
    payload: VaccinationCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add new vaccination record.
    Patient ID MUST NOT be accepted from frontend untrusted body. Extracted from authenticated JWT.
    """
    user_email = current_user["sub"]
    role = current_user.get("role", "patient")

    # Patient ID is always bound to authenticated identity or authorized relationship
    patient_id = user_email

    # Determine provenance & verification state
    record_source = "PATIENT_ENTERED"
    verified = False
    verified_by = None
    verified_at = None

    if role == "doctor":
        record_source = "DOCTOR_ENTERED"
        verified = True
        doc = await doctors_collection.find_one({"email": user_email})
        verified_by = doc.get("name") if doc else user_email
        verified_at = time.time()
    elif role == "hospital":
        record_source = "HOSPITAL_ENTERED"
        verified = True
        fac = await healthcare_facilities_collection.find_one({"admin_email": user_email})
        verified_by = fac.get("name") if fac else user_email
        verified_at = time.time()

    # Validation checks
    if not payload.vaccine_name or not payload.vaccine_name.strip():
        raise HTTPException(status_code=400, detail="Vaccine name cannot be empty.")

    if payload.dose_number <= 0:
        raise HTTPException(status_code=400, detail="Dose number must be greater than zero.")

    v_date_obj = parse_date(payload.vaccination_date)
    if not v_date_obj:
        raise HTTPException(status_code=400, detail="Invalid vaccination date format. Expected YYYY-MM-DD.")

    if payload.next_due_date:
        nd_date_obj = parse_date(payload.next_due_date)
        if not nd_date_obj:
            raise HTTPException(status_code=400, detail="Invalid next due date format. Expected YYYY-MM-DD.")
        if nd_date_obj < v_date_obj:
            raise HTTPException(status_code=400, detail="Impossible date ordering: Next due date cannot be earlier than vaccination date.")

    # Calculate status deterministically
    computed_status = compute_backend_status(
        payload.vaccination_date,
        payload.next_due_date,
        payload.is_completed
    )

    # Business rule duplicate check: same patient, same vaccine, same dose, same date
    existing_duplicate = await vaccinations_collection.find_one({
        "patient_id": patient_id,
        "vaccine_name": payload.vaccine_name.strip(),
        "dose_number": payload.dose_number,
        "vaccination_date": payload.vaccination_date
    })
    if existing_duplicate:
        raise HTTPException(
            status_code=409,
            detail=f"A record for {payload.vaccine_name} (Dose {payload.dose_number}) on {payload.vaccination_date} already exists."
        )

    now = time.time()
    doc = {
        "patient_id": patient_id,
        "vaccine_name": payload.vaccine_name.strip(),
        "vaccine_code": payload.vaccine_code or f"CVX-{abs(hash(payload.vaccine_name)) % 1000:03d}",
        "dose_number": payload.dose_number,
        "dose_label": payload.dose_label or f"Dose {payload.dose_number}",
        "vaccination_date": payload.vaccination_date,
        "next_due_date": payload.next_due_date,
        "is_completed": payload.is_completed,
        "status": computed_status,
        "notes": payload.notes or "",
        "provider_name": payload.provider_name or ("Doctor / Facility" if verified else "Patient Self-Reported"),
        "provider_type": payload.provider_type or "Clinic / Hospital",
        "facility_name": payload.facility_name or "SwasthyaSetu Mesh Network",
        "facility_id": payload.facility_id or "FAC-001",
        "record_source": record_source,
        "verified": verified,
        "verified_by": verified_by,
        "verified_at": verified_at,
        "document_reference": payload.document_reference,
        "reminder_enabled": payload.reminder_enabled,
        "reminder_days_before": payload.reminder_days_before,
        "created_at": now,
        "updated_at": now
    }

    result = await vaccinations_collection.insert_one(doc)
    record_id = str(result.inserted_id)

    # Trigger audit log
    await log_audit_event(
        user_email=user_email,
        role=role,
        action="VACCINATION_CREATED",
        patient_id=patient_id,
        record_id=record_id,
        details={"vaccine_name": payload.vaccine_name, "status": computed_status}
    )

    # Trigger smart reminder if applicable
    if payload.reminder_enabled and computed_status in ["DUE_SOON", "OVERDUE", "UPCOMING", "MISSED"]:
        await send_smart_reminder(
            patient_email=patient_id,
            vaccination_id=record_id,
            vaccine_name=payload.vaccine_name,
            status=computed_status,
            due_date_str=payload.next_due_date or payload.vaccination_date
        )

    doc["id"] = record_id
    doc["_id"] = record_id
    return doc


@router.get("/history")
async def get_vaccination_history(
    patient_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve vaccination timeline and history payload for visualization.
    """
    target_patient = patient_id or current_user["sub"]
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized access to vaccination history.")

    cursor = vaccinations_collection.find({"patient_id": target_patient}).sort("vaccination_date", 1)
    history_items = []
    async for r in cursor:
        r["id"] = str(r["_id"])
        r["_id"] = str(r["_id"])
        r["status"] = compute_backend_status(
            r.get("vaccination_date", ""),
            r.get("next_due_date"),
            r.get("is_completed", True),
            r.get("status")
        )
        history_items.append(r)

    total_tracked = len(history_items)
    completed_count = sum(1 for h in history_items if h["status"] == "COMPLETED")
    progress_percentage = round((completed_count / total_tracked * 100), 1) if total_tracked > 0 else 0.0

    return {
        "patient_id": target_patient,
        "total_tracked": total_tracked,
        "completed_count": completed_count,
        "progress_percentage": progress_percentage,
        "progress_label": "Tracked vaccination completion",
        "timeline": history_items
    }


@router.get("/{vaccination_id}")
async def get_vaccination_detail(
    vaccination_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve detailed view of a single vaccination record."""
    if not ObjectId.is_valid(vaccination_id):
        raise HTTPException(status_code=400, detail="Invalid vaccination record ID format.")

    record = await vaccinations_collection.find_one({"_id": ObjectId(vaccination_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Vaccination record not found.")

    if not await verify_authorization(current_user, record["patient_id"]):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized access to record.")

    record["id"] = str(record["_id"])
    record["_id"] = str(record["_id"])
    record["status"] = compute_backend_status(
        record.get("vaccination_date", ""),
        record.get("next_due_date"),
        record.get("is_completed", True),
        record.get("status")
    )
    return record


@router.put("/{vaccination_id}")
async def update_vaccination(
    vaccination_id: str,
    payload: VaccinationUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update vaccination record with strict server-side authorization and audit logging.
    """
    if not ObjectId.is_valid(vaccination_id):
        raise HTTPException(status_code=400, detail="Invalid vaccination record ID format.")

    record = await vaccinations_collection.find_one({"_id": ObjectId(vaccination_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Vaccination record not found.")

    user_email = current_user["sub"]
    role = current_user.get("role", "patient")

    if not await verify_authorization(current_user, record["patient_id"]):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized modification attempt.")

    update_dict = {k: v for k, v in payload.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    if "vaccine_name" in update_dict and (not update_dict["vaccine_name"] or not update_dict["vaccine_name"].strip()):
        raise HTTPException(status_code=400, detail="Vaccine name cannot be empty.")

    if "dose_number" in update_dict and update_dict["dose_number"] <= 0:
        raise HTTPException(status_code=400, detail="Dose number must be greater than zero.")

    v_date = update_dict.get("vaccination_date", record.get("vaccination_date"))
    nd_date = update_dict.get("next_due_date", record.get("next_due_date"))
    is_comp = update_dict.get("is_completed", record.get("is_completed", True))

    v_date_obj = parse_date(v_date)
    if not v_date_obj:
        raise HTTPException(status_code=400, detail="Invalid vaccination date format.")

    if nd_date:
        nd_date_obj = parse_date(nd_date)
        if not nd_date_obj:
            raise HTTPException(status_code=400, detail="Invalid next due date format.")
        if nd_date_obj < v_date_obj:
            raise HTTPException(status_code=400, detail="Impossible date ordering: Next due date cannot be earlier than vaccination date.")

    computed_status = compute_backend_status(v_date, nd_date, is_comp, update_dict.get("status"))
    update_dict["status"] = computed_status
    update_dict["updated_at"] = time.time()

    # Medical verification if updated by Doctor or Hospital
    if role in ["doctor", "hospital"] and update_dict.get("verified") is not False:
        update_dict["verified"] = True
        update_dict["verified_by"] = user_email
        update_dict["verified_at"] = time.time()

    await vaccinations_collection.update_one(
        {"_id": ObjectId(vaccination_id)},
        {"$set": update_dict}
    )

    # Log audit event
    await log_audit_event(
        user_email=user_email,
        role=role,
        action="VACCINATION_UPDATED",
        patient_id=record["patient_id"],
        record_id=vaccination_id,
        details=update_dict
    )

    updated_record = await vaccinations_collection.find_one({"_id": ObjectId(vaccination_id)})
    updated_record["id"] = str(updated_record["_id"])
    updated_record["_id"] = str(updated_record["_id"])
    return updated_record


@router.delete("/{vaccination_id}")
async def delete_vaccination(
    vaccination_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Secure deletion with ownership verification and audit logging.
    """
    if not ObjectId.is_valid(vaccination_id):
        raise HTTPException(status_code=400, detail="Invalid vaccination record ID format.")

    record = await vaccinations_collection.find_one({"_id": ObjectId(vaccination_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Vaccination record not found.")

    user_email = current_user["sub"]
    role = current_user.get("role", "patient")

    if not await verify_authorization(current_user, record["patient_id"]):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized deletion attempt.")

    # Execute deletion
    await vaccinations_collection.delete_one({"_id": ObjectId(vaccination_id)})

    # Log audit event
    await log_audit_event(
        user_email=user_email,
        role=role,
        action="VACCINATION_DELETED",
        patient_id=record["patient_id"],
        record_id=vaccination_id,
        details={"vaccine_name": record.get("vaccine_name"), "deleted_at": time.time()}
    )

    return {"message": "Vaccination record deleted successfully.", "record_id": vaccination_id}


@router.post("/{vaccination_id}/verify")
async def verify_vaccination_record(
    vaccination_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Doctor/Hospital verification endpoint for unverified records.
    """
    if not ObjectId.is_valid(vaccination_id):
        raise HTTPException(status_code=400, detail="Invalid vaccination record ID format.")

    role = current_user.get("role")
    if role not in ["doctor", "hospital", "admin"]:
        raise HTTPException(status_code=403, detail="Only healthcare providers can medically verify records.")

    record = await vaccinations_collection.find_one({"_id": ObjectId(vaccination_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Vaccination record not found.")

    verifier_name = current_user.get("name") or current_user["sub"]

    await vaccinations_collection.update_one(
        {"_id": ObjectId(vaccination_id)},
        {"$set": {
            "verified": True,
            "verified_by": verifier_name,
            "verified_at": time.time(),
            "updated_at": time.time()
        }}
    )

    await log_audit_event(
        user_email=current_user["sub"],
        role=role,
        action="VACCINATION_VERIFIED",
        patient_id=record["patient_id"],
        record_id=vaccination_id,
        details={"verified_by": verifier_name}
    )

    return {"message": "Record medically verified successfully.", "record_id": vaccination_id}


@router.get("/export/pdf")
async def export_vaccination_record(
    patient_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Generate clean, verifiable structured immunization export.
    """
    target_patient = patient_id or current_user["sub"]
    if not await verify_authorization(current_user, target_patient):
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized export request.")

    cursor = vaccinations_collection.find({"patient_id": target_patient}).sort("vaccination_date", 1)
    records = []
    async for r in cursor:
        r["_id"] = str(r["_id"])
        records.append(r)

    summary = {
        "patient_id": target_patient,
        "exported_at": datetime.now().isoformat(),
        "total_records": len(records),
        "issuing_authority": "SwasthyaSetu AI Enterprise Healthcare Mesh",
        "verification_notice": "Verifiable database export. Official government certificates require national portal integration.",
        "records": records
    }
    return summary


# =============================================================================
# CHILD VACCINATION TRACKING SYSTEM ENDPOINTS
# =============================================================================

@router.post("/children")
async def create_child(
    payload: ChildCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a new child to parent's profile and auto-calculate current age & schedule."""
    parent_id = current_user["sub"]
    dob_obj = parse_date(payload.date_of_birth)
    if not dob_obj:
        raise HTTPException(status_code=400, detail="Invalid date of birth format. Expected YYYY-MM-DD.")
    if dob_obj > date.today():
        raise HTTPException(status_code=400, detail="Date of birth cannot be in the future.")

    now = time.time()
    child_doc = {
        "parent_id": parent_id,
        "name": payload.name.strip(),
        "date_of_birth": payload.date_of_birth.strip(),
        "gender": payload.gender or "unspecified",
        "location": payload.location or "",
        "district": payload.district or "",
        "state": payload.state or "",
        "is_je_endemic": payload.is_je_endemic or False,
        "created_at": now,
        "updated_at": now
    }

    res = await children_collection.insert_one(child_doc)
    child_id = str(res.inserted_id)
    child_doc["_id"] = child_id
    child_doc["id"] = child_id
    child_doc["age_info"] = calculate_child_age(payload.date_of_birth)

    await log_audit_event(
        user_email=parent_id,
        role=current_user.get("role", "patient"),
        action="CHILD_CREATED",
        patient_id=parent_id,
        record_id=child_id,
        details={"child_name": payload.name, "dob": payload.date_of_birth}
    )

    return child_doc


@router.get("/children")
async def list_children(
    current_user: dict = Depends(get_current_user)
):
    """Retrieve all children profiles managed by the logged-in parent with current age breakdown."""
    parent_id = current_user["sub"]
    cursor = children_collection.find({"parent_id": parent_id}).sort("created_at", -1)
    children = []
    async for c in cursor:
        cid = str(c["_id"])
        c["_id"] = cid
        c["id"] = cid
        c["age_info"] = calculate_child_age(c.get("date_of_birth", ""))
        children.append(c)

    return children


@router.get("/children/{child_id}")
async def get_child_detail(
    child_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve details for a single child profile."""
    if not ObjectId.is_valid(child_id):
        raise HTTPException(status_code=400, detail="Invalid child ID format.")

    child = await children_collection.find_one({"_id": ObjectId(child_id)})
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found.")

    if child["parent_id"] != current_user["sub"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Access to this child profile is restricted.")

    cid = str(child["_id"])
    child["_id"] = cid
    child["id"] = cid
    child["age_info"] = calculate_child_age(child.get("date_of_birth", ""))
    return child


@router.delete("/children/{child_id}")
async def delete_child_profile(
    child_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a child profile and remove associated immunization records & reminders."""
    if not ObjectId.is_valid(child_id):
        raise HTTPException(status_code=400, detail="Invalid child ID format.")

    child = await children_collection.find_one({"_id": ObjectId(child_id)})
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found.")

    if child["parent_id"] != current_user["sub"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Deletion restricted.")

    await children_collection.delete_one({"_id": ObjectId(child_id)})
    await vaccination_records_collection.delete_many({"child_id": child_id})
    await vaccination_reminders_collection.delete_many({"child_id": child_id})

    return {"message": "Child profile deleted successfully.", "child_id": child_id}


@router.get("/children/{child_id}/schedule")
async def get_child_schedule(
    child_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    GOVERNMENT IMMUNIZATION SCHEDULE ENGINE
    Calculates the exact National Immunization Schedule (NIS) timeline based on DOB and location.
    Determines status deterministically: COMPLETED, UPCOMING, DUE, OVERDUE, NOT_APPLICABLE.
    """
    if not ObjectId.is_valid(child_id):
        raise HTTPException(status_code=400, detail="Invalid child ID format.")

    child = await children_collection.find_one({"_id": ObjectId(child_id)})
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found.")

    if child["parent_id"] != current_user["sub"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Unauthorized access.")

    cid = str(child["_id"])
    age_info = calculate_child_age(child.get("date_of_birth", ""))

    # Fetch recorded vaccinations for this child
    cursor = vaccination_records_collection.find({"child_id": cid})
    records_by_vid = {}
    async for r in cursor:
        r["_id"] = str(r["_id"])
        r["id"] = str(r["_id"])
        records_by_vid[r.get("vaccine_id")] = r

    dob = parse_date(child.get("date_of_birth"))
    today = date.today()

    # Determine JE endemic status based on location/flag
    child_state = (child.get("state") or "").lower()
    child_district = (child.get("district") or "").lower()
    child_loc = (child.get("location") or "").lower()
    is_je = child.get("is_je_endemic", False)
    if not is_je:
        endemic_keywords = ["assam", "bihar", "uttar pradesh", "up", "west bengal", "wb", "tamil nadu", "tn", "karnataka", "andhra", "telangana", "kerala", "odisha", "goa", "manipur", "puducherry", "tripura"]
        if any(k in child_state or k in child_district or k in child_loc for k in endemic_keywords):
            is_je = True

    timeline = []
    total_vaccines = 0
    completed_count = 0
    upcoming_count = 0
    due_count = 0
    overdue_count = 0

    for milestone in NIS_SCHEDULE_DEFINITION:
        ms_id = milestone["milestone_id"]
        ms_label = milestone["milestone_label"]
        ms_vaccines = []

        for vdef in milestone["vaccines"]:
            vid = vdef["vaccine_id"]
            is_je_only = vdef.get("is_je_endemic_only", False)

            # Window calculation relative to DOB
            w_start = dob + timedelta(days=vdef["min_offset_days"]) if dob else today
            w_end = dob + timedelta(days=vdef["max_offset_days"]) if dob else today

            w_start_str = w_start.strftime("%Y-%m-%d")
            w_end_str = w_end.strftime("%Y-%m-%d")

            # Check matching recorded vaccination
            rec = records_by_vid.get(vid)

            # Deterministic status engine
            if is_je_only and not is_je:
                status = "NOT_APPLICABLE"
            elif rec and rec.get("administered_date"):
                status = "COMPLETED"
            elif today < w_start:
                status = "UPCOMING"
            elif w_start <= today <= w_end:
                status = "DUE"
            else:
                status = "OVERDUE"

            if status != "NOT_APPLICABLE":
                total_vaccines += 1
                if status == "COMPLETED":
                    completed_count += 1
                elif status == "UPCOMING":
                    upcoming_count += 1
                elif status == "DUE":
                    due_count += 1
                elif status == "OVERDUE":
                    overdue_count += 1

            days_remaining = (w_start - today).days if status == "UPCOMING" else ((w_end - today).days if status == "DUE" else (today - w_end).days)

            v_item = {
                "vaccine_id": vid,
                "vaccine_name": vdef["vaccine_name"],
                "full_name": vdef["full_name"],
                "dose": vdef["dose"],
                "route": vdef["route"],
                "recommended_age": vdef["recommended_age"],
                "window_start": w_start_str,
                "window_end": w_end_str,
                "scheduled_window": f"{w_start.strftime('%b %d, %Y')} – {w_end.strftime('%b %d, %Y')}",
                "status": status,
                "days_offset": days_remaining,
                "record": rec,
                "administered_date": rec.get("administered_date") if rec else None,
                "facility_name": rec.get("facility_name") if rec else None,
                "notes": rec.get("notes") if rec else None
            }
            ms_vaccines.append(v_item)

        timeline.append({
            "milestone_id": ms_id,
            "milestone_label": ms_label,
            "vaccines": ms_vaccines
        })

    progress = round((completed_count / total_vaccines * 100), 1) if total_vaccines > 0 else 0.0

    return {
        "child_id": cid,
        "child_name": child.get("name"),
        "date_of_birth": child.get("date_of_birth"),
        "gender": child.get("gender"),
        "location": child.get("location"),
        "district": child.get("district"),
        "state": child.get("state"),
        "is_je_endemic": is_je,
        "age_info": age_info,
        "metrics": {
            "total": total_vaccines,
            "completed": completed_count,
            "upcoming": upcoming_count,
            "due": due_count,
            "overdue": overdue_count,
            "progress_percentage": progress
        },
        "timeline": timeline
    }


@router.get("/children/{child_id}/next")
async def get_next_child_vaccination(
    child_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    NEXT VACCINATION ENGINE
    Calculates the single next relevant vaccination due for a child.
    """
    sched = await get_child_schedule(child_id, current_user)
    timeline = sched.get("timeline", [])

    candidates = []
    for ms in timeline:
        for v in ms["vaccines"]:
            if v["status"] in ["OVERDUE", "DUE", "UPCOMING"]:
                candidates.append(v)

    if not candidates:
        return {
            "has_next": False,
            "message": "All National Immunization Schedule vaccinations completed!",
            "child_name": sched.get("child_name")
        }

    # Priority 1: OVERDUE (earliest due window end)
    overdue_cand = [c for c in candidates if c["status"] == "OVERDUE"]
    if overdue_cand:
        overdue_cand.sort(key=lambda x: x["window_end"])
        next_v = overdue_cand[0]
    else:
        # Priority 2: DUE (earliest due window end)
        due_cand = [c for c in candidates if c["status"] == "DUE"]
        if due_cand:
            due_cand.sort(key=lambda x: x["window_end"])
            next_v = due_cand[0]
        else:
            # Priority 3: UPCOMING (earliest due window start)
            up_cand = [c for c in candidates if c["status"] == "UPCOMING"]
            up_cand.sort(key=lambda x: x["window_start"])
            next_v = up_cand[0]

    return {
        "has_next": True,
        "child_id": child_id,
        "child_name": sched.get("child_name"),
        "next_vaccination": next_v
    }


@router.get("/children/{child_id}/gaps")
async def get_child_immunization_gaps(
    child_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Detect overdue vaccinations and schedule gaps for a child."""
    sched = await get_child_schedule(child_id, current_user)
    timeline = sched.get("timeline", [])

    gaps = []
    for ms in timeline:
        for v in ms["vaccines"]:
            if v["status"] == "OVERDUE":
                gaps.append(v)

    return {
        "child_id": child_id,
        "child_name": sched.get("child_name"),
        "gaps_count": len(gaps),
        "gaps": gaps,
        "safety_disclaimer": "Vaccination information is based on the configured Government Immunization Schedule. For medical questions or changes to vaccination plans, consult a qualified healthcare professional."
    }


@router.post("/children/{child_id}/records")
@router.post("/{child_id}/records")
async def record_child_vaccination(
    child_id: str,
    payload: ChildVaccinationRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Log actual vaccination date and provider details for a child.
    Prevents duplicate entries and updates schedule progress immediately.
    """
    if not ObjectId.is_valid(child_id):
        raise HTTPException(status_code=400, detail="Invalid child ID format.")

    child = await children_collection.find_one({"_id": ObjectId(child_id)})
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found.")

    if child["parent_id"] != current_user["sub"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Record administration restricted.")

    admin_date = parse_date(payload.administered_date)
    if not admin_date:
        raise HTTPException(status_code=400, detail="Invalid administered date format. Expected YYYY-MM-DD.")
    if admin_date > date.today():
        raise HTTPException(status_code=400, detail="Vaccination date cannot be in the future.")

    now = time.time()
    record_doc = {
        "child_id": child_id,
        "parent_id": current_user["sub"],
        "vaccine_id": payload.vaccine_id,
        "vaccine_name": payload.vaccine_name,
        "administered_date": payload.administered_date.strip(),
        "facility_id": payload.facility_id or "",
        "facility_name": payload.facility_name or "",
        "notes": payload.notes or "",
        "dose": payload.dose or "",
        "status": "COMPLETED",
        "created_at": now,
        "updated_at": now
    }

    await vaccination_records_collection.update_one(
        {"child_id": child_id, "vaccine_id": payload.vaccine_id},
        {"$set": record_doc},
        upsert=True
    )

    rec = await vaccination_records_collection.find_one({"child_id": child_id, "vaccine_id": payload.vaccine_id})
    rec["_id"] = str(rec["_id"])
    rec["id"] = str(rec["_id"])

    await log_audit_event(
        user_email=current_user["sub"],
        role=current_user.get("role", "patient"),
        action="CHILD_VACCINE_RECORDED",
        patient_id=current_user["sub"],
        record_id=rec["id"],
        details={"child_id": child_id, "vaccine_name": payload.vaccine_name, "administered_date": payload.administered_date}
    )

    return rec


@router.delete("/children/{child_id}/records/{record_id}")
@router.delete("/{child_id}/records/{record_id}")
async def delete_child_vaccination_record(
    child_id: str,
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a recorded vaccination for a child."""
    if not ObjectId.is_valid(record_id):
        raise HTTPException(status_code=400, detail="Invalid record ID format.")

    rec = await vaccination_records_collection.find_one({"_id": ObjectId(record_id)})
    if not rec:
        raise HTTPException(status_code=404, detail="Vaccination record not found.")

    if rec["parent_id"] != current_user["sub"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Deletion restricted.")

    await vaccination_records_collection.delete_one({"_id": ObjectId(record_id)})

    return {"message": "Vaccination record removed successfully.", "record_id": record_id}


@router.post("/reminders")
async def create_vaccination_reminder(
    payload: ChildReminderCreate,
    current_user: dict = Depends(get_current_user)
):
    """Set a vaccination reminder for a child."""
    parent_id = current_user["sub"]
    now = time.time()

    reminder_doc = {
        "parent_id": parent_id,
        "child_id": payload.child_id,
        "vaccine_id": payload.vaccine_id,
        "vaccine_name": payload.vaccine_name,
        "reminder_date": payload.reminder_date or date.today().strftime("%Y-%m-%d"),
        "created_at": now,
        "status": "ACTIVE"
    }

    res = await vaccination_reminders_collection.insert_one(reminder_doc)

    await notifications_collection.insert_one({
        "recipient_email": parent_id,
        "recipient_role": "patient",
        "title": f"🔔 Vaccination Reminder: {payload.vaccine_name}",
        "message": f"Vaccination reminder configured for {payload.vaccine_name}.",
        "vaccination_id": str(res.inserted_id),
        "reminder_type": "USER_SET",
        "due_date": payload.reminder_date,
        "timestamp": now,
        "read": False
    })

    return {"message": "Vaccination reminder configured successfully.", "reminder_id": str(res.inserted_id)}


@router.get("/reminders")
async def list_vaccination_reminders(
    current_user: dict = Depends(get_current_user)
):
    """Retrieve active vaccination reminders for the parent."""
    parent_id = current_user["sub"]
    cursor = vaccination_reminders_collection.find({"parent_id": parent_id}).sort("created_at", -1)
    reminders = []
    async for r in cursor:
        r["_id"] = str(r["_id"])
        r["id"] = str(r["_id"])
        reminders.append(r)
    return reminders


@router.post("/ai-explain")
async def ai_explain_vaccine(
    payload: AIExplainRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Educational AI Assistant for parents.
    Explains vaccine importance, benefits, gaps, and answers parent questions.
    Does NOT override official schedule or generate clinic dates.
    """
    prompt = f"""
    The user is a parent asking about the vaccine: '{payload.vaccine_name}'.
    Child age context: '{payload.child_age or "Infant"}'.
    Parent question: '{payload.question or "What is this vaccine and why is it important for my child?"}'.
    
    Instructions:
    1. Provide a clear, compassionate, and easy-to-understand explanation for a parent.
    2. Explain what disease the vaccine protects against and why it is given under the Government of India National Immunization Schedule (NIS).
    3. Include common mild post-vaccination reactions (like mild fever or soreness) and simple home care tips.
    4. MUST include a safety disclaimer recommending consultation with a doctor or health center worker.
    5. DO NOT invent dates or override the official schedule.
    """
    
    try:
        response_text = await AIService._call_ai(prompt, json_mode=False)
    except Exception:
        response_text = f"The {payload.vaccine_name} vaccine is an essential immunization under the Government of India National Immunization Schedule (NIS). It provides critical protection against serious infectious diseases. Common mild reactions include slight fever or temporary soreness at the injection site. Always consult a qualified healthcare provider or ANM worker at your nearest Government Health Center for specific guidance."

    return {
        "vaccine_name": payload.vaccine_name,
        "explanation": response_text,
        "disclaimer": "Vaccination information is based on the configured Government Immunization Schedule. For medical questions or changes to vaccination plans, consult a qualified healthcare professional."
    }

