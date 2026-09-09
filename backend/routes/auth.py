from fastapi import APIRouter, HTTPException, BackgroundTasks, Response, Request, Depends, Body
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import bcrypt
import random
import time
import hashlib
import uuid
from database import (
    users_collection, 
    otp_collection, 
    profile_collection, 
    doctors_collection, 
    healthcare_facilities_collection,
    ambulances_collection
)
from services.email_service import send_otp_email
from utils.jwt_handler import create_access_token, get_current_user
from config import Config

router = APIRouter()

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    role: str = "patient"  # patient, doctor, hospital
    # Patient fields
    age: Optional[int] = 25
    gender: Optional[str] = "Other"
    
    # Doctor fields
    specialization: Optional[str] = None
    experience_years: Optional[int] = 0
    qualification: Optional[str] = "MBBS"
    facility_name: Optional[str] = None
    facility_id: Optional[str] = None
    consultation_mode: Optional[str] = "Both"  # Online, In-Person, Both
    availability: Optional[str] = "Mon-Fri 09:00 - 17:00"
    working_days: Optional[List[str]] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    start_time: Optional[str] = "09:00"
    end_time: Optional[str] = "17:00"

    # Hospital fields
    hospital_name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = 19.0760
    longitude: Optional[float] = 72.8777
    departments: Optional[List[str]] = ["General Medicine", "Emergency", "Cardiology", "ICU"]
    services: Optional[List[str]] = ["24/7 Emergency", "ICU", "Ambulance", "Pathology Lab", "Radiology", "Pharmacy"]
    general_beds: Optional[int] = 50
    icu_beds: Optional[int] = 10
    emergency_beds: Optional[int] = 5
    emergency_24_7: Optional[bool] = True
    ambulance_count: Optional[int] = 2

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

def hash_otp(otp: str):
    return hashlib.sha256(otp.encode()).hexdigest()

def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    try:
        password_bytes = password.encode('utf-8')
        hashed_bytes = hashed.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

@router.post("/register")
async def register(request: RegisterRequest, background_tasks: BackgroundTasks):
    # Check if user exists
    existing = await users_collection.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Identity already registered in the mesh.")
    
    otp = str(random.randint(100000, 999999))
    hashed_otp = hash_otp(otp)
    expiry = int(time.time()) + 600  # 10 minutes
    
    pending_data = request.dict()
    pending_data["password_hash"] = hash_password(request.password)
    del pending_data["password"]
    
    pending_user = {
        "email": request.email,
        "otp": hashed_otp,
        "expiry": expiry,
        "data": pending_data
    }
    
    await otp_collection.update_one(
        {"email": request.email},
        {"$set": pending_user},
        upsert=True
    )
    
    background_tasks.add_task(send_otp_email, request.email, otp)
    return {"message": "Verification code dispatched to your workstation."}

@router.post("/verify-otp")
async def verify_otp(request: VerifyOTPRequest, response: Response):
    record = await otp_collection.find_one({"email": request.email})
    
    if not record or "data" not in record:
        raise HTTPException(status_code=400, detail="Verification session not found.")
    
    if int(time.time()) > record["expiry"]:
        raise HTTPException(status_code=400, detail="Verification code expired.")
    
    if hash_otp(request.otp) != record["otp"]:
        raise HTTPException(status_code=400, detail="Authorization code mismatch.")
    
    # Finalize Registration
    user_data = record["data"]
    role = user_data.get("role", "patient")
    
    user_doc = {
        "email": request.email,
        "password_hash": user_data["password_hash"],
        "role": role,
        "name": user_data.get("name") or user_data.get("hospital_name") or "User",
        "created_at": time.time()
    }
    await users_collection.insert_one(user_doc)
    
    # Role-specific database synthesis
    if role == "doctor":
        doc_id = f"DOC-{uuid.uuid4().hex[:6].upper()}"
        doctor_doc = {
            "doctor_id": doc_id,
            "email": request.email,
            "name": user_data.get("name", "Doctor"),
            "specialization": user_data.get("specialization") or "General Physician",
            "qualification": user_data.get("qualification") or "MBBS",
            "experience_years": user_data.get("experience_years", 1),
            "facility_id": user_data.get("facility_id") or "FAC-001",
            "facility_name": user_data.get("facility_name") or "SwasthyaSetu Medical Center",
            "phone": user_data.get("phone", ""),
            "consultation_mode": user_data.get("consultation_mode", "Both"),
            "telemedicine_enabled": True,
            "is_verified": True,
            "availability": user_data.get("availability") or "Mon-Fri 09:00 - 17:00",
            "working_days": user_data.get("working_days") or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "start_time": user_data.get("start_time") or "09:00",
            "end_time": user_data.get("end_time") or "17:00",
            "status": "ONLINE",
            "created_at": time.time()
        }
        await doctors_collection.update_one(
            {"email": request.email},
            {"$set": doctor_doc},
            upsert=True
        )
        
        # Profile document
        profile_doc = {
            "email": request.email,
            "name": user_data.get("name"),
            "phone": user_data.get("phone"),
            "specialization": user_data.get("specialization"),
            "doctor_id": doc_id,
            "role": "doctor"
        }
        await profile_collection.insert_one(profile_doc)

    elif role == "hospital":
        fac_id = f"FAC-{uuid.uuid4().hex[:6].upper()}"
        hosp_name = user_data.get("hospital_name") or user_data.get("name") or "Medical Center"
        
        hospital_doc = {
            "facility_id": fac_id,
            "name": hosp_name,
            "admin_email": request.email,
            "phone": user_data.get("phone"),
            "type": "Hospital",
            "category": "Multi-Specialty Hospital",
            "address": user_data.get("address") or "City Central",
            "city": user_data.get("city") or "Mumbai",
            "latitude": user_data.get("latitude", 19.0760),
            "longitude": user_data.get("longitude", 72.8777),
            "departments": user_data.get("departments") or ["General Medicine", "Cardiology", "Emergency", "ICU"],
            "services": user_data.get("services") or ["24/7 Emergency", "ICU", "Ambulance", "Pathology Lab"],
            "specialists": [f"{dept} Specialist" for dept in (user_data.get("departments") or ["General Medicine", "Cardiology"])],
            "bed_capacity": {
                "total": (user_data.get("general_beds", 50) + user_data.get("icu_beds", 10) + user_data.get("emergency_beds", 5)),
                "general_available": user_data.get("general_beds", 50),
                "icu_available": user_data.get("icu_beds", 10),
                "emergency_available": user_data.get("emergency_beds", 5)
            },
            "emergency_24_7": user_data.get("emergency_24_7", True),
            "has_icu": (user_data.get("icu_beds", 0) > 0),
            "has_telemedicine": True,
            "has_ambulance": (user_data.get("ambulance_count", 0) > 0),
            "ambulance_count": user_data.get("ambulance_count", 2),
            "operating_hours": "24 Hours / Open All Days",
            "created_at": time.time()
        }
        await healthcare_facilities_collection.update_one(
            {"admin_email": request.email},
            {"$set": hospital_doc},
            upsert=True
        )

        # Seed initial ambulances for this hospital if specified
        amb_count = user_data.get("ambulance_count", 2)
        if amb_count > 0:
            for i in range(1, amb_count + 1):
                amb_id = f"AMB-{fac_id[-4:]}-0{i}"
                await ambulances_collection.update_one(
                    {"ambulance_id": amb_id},
                    {"$set": {
                        "ambulance_id": amb_id,
                        "vehicle_type": "Advanced Life Support (ALS) Ambulance" if i == 1 else "Basic Life Support (BLS) Ambulance",
                        "operator": f"{hosp_name} Rapid Dispatch",
                        "base_facility_id": fac_id,
                        "base_facility_name": hosp_name,
                        "latitude": user_data.get("latitude", 19.0760),
                        "longitude": user_data.get("longitude", 72.8777),
                        "status": "Available",
                        "emergency_phone": user_data.get("phone", "108"),
                        "equipment": ["Ventilator", "Oxygen Support", "Paramedic Crew", "Defibrillator"],
                        "last_updated": time.time()
                    }},
                    upsert=True
                )

        profile_doc = {
            "email": request.email,
            "name": hosp_name,
            "phone": user_data.get("phone"),
            "facility_id": fac_id,
            "role": "hospital"
        }
        await profile_collection.insert_one(profile_doc)

    else:
        # Patient Profile
        profile_doc = {
            "email": request.email,
            "name": user_data.get("name"),
            "phone": user_data.get("phone"),
            "age": user_data.get("age", 25),
            "gender": user_data.get("gender", "Other"),
            "dob": "Not Set",
            "mobile": user_data.get("phone"),
            "blood_group": "Not Set",
            "emergency_contact": "Not Set",
            "role": "patient"
        }
        await profile_collection.insert_one(profile_doc)
    
    # Clear session
    await otp_collection.delete_one({"email": request.email})
    
    return {"message": "Account synthesized successfully.", "role": role}

@router.post("/login")
async def login(request: LoginRequest, response: Response):
    user = await users_collection.find_one({"email": request.email})
    if not user or not verify_password(request.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credential matrix.")
    
    role = user.get("role", "patient")
    
    # Determine display name & metadata
    name = user.get("name")
    facility_id = None
    doctor_id = None
    specialization = None

    if role == "doctor":
        doc = await doctors_collection.find_one({"email": request.email})
        if doc:
            name = doc.get("name", name)
            doctor_id = doc.get("doctor_id")
            facility_id = doc.get("facility_id")
            specialization = doc.get("specialization")
    elif role == "hospital":
        fac = await healthcare_facilities_collection.find_one({"admin_email": request.email})
        if fac:
            name = fac.get("name", name)
            facility_id = fac.get("facility_id")
    else:
        prof = await profile_collection.find_one({"email": request.email})
        if prof:
            name = prof.get("name", name)

    token_payload = {
        "sub": request.email,
        "name": name or request.email.split("@")[0],
        "role": role,
        "facility_id": facility_id,
        "doctor_id": doctor_id
    }
    token = create_access_token(token_payload)
    
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=Config.JWT_EXPIRATION,
        expires=Config.JWT_EXPIRATION,
        samesite="lax",
        secure=False,
        path="/"
    )
    
    return {
        "message": "Neural link established.",
        "name": name or request.email.split("@")[0],
        "email": request.email,
        "role": role,
        "facility_id": facility_id,
        "doctor_id": doctor_id,
        "specialization": specialization,
        "user_id": str(user["_id"]),
        "token": token
    }

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    user = await users_collection.find_one({"email": request.email})
    if not user:
        return {"message": "If the account exists, a reset code has been sent."}
    
    otp = str(random.randint(100000, 999999))
    hashed_otp = hash_otp(otp)
    expiry = int(time.time()) + 300
    
    await otp_collection.update_one(
        {"email": request.email},
        {"$set": {"otp": hashed_otp, "expiry": expiry}},
        upsert=True
    )
    
    background_tasks.add_task(send_otp_email, request.email, otp)
    return {"message": "Recovery sequence initiated. Check your mail."}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    record = await otp_collection.find_one({"email": request.email})
    if not record or hash_otp(request.otp) != record["otp"] or int(time.time()) > record["expiry"]:
         raise HTTPException(status_code=400, detail="Invalid or expired reset code.")
    
    new_hash = hash_password(request.new_password)
    await users_collection.update_one({"email": request.email}, {"$set": {"password_hash": new_hash}})
    await otp_collection.delete_one({"email": request.email})
    
    return {"message": "Vault credentials updated successfully."}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    email = current_user["sub"]
    user = await users_collection.find_one({"email": email})
    role = user.get("role", "patient") if user else current_user.get("role", "patient")
    
    doctor_info = None
    hospital_info = None
    if role == "doctor":
        doctor_info = await doctors_collection.find_one({"email": email}, {"_id": 0})
    elif role == "hospital":
        hospital_info = await healthcare_facilities_collection.find_one({"admin_email": email}, {"_id": 0})
        
    return {
        "email": email,
        "name": current_user.get("name", "User"),
        "role": role,
        "doctor": doctor_info,
        "hospital": hospital_info
    }

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Neural link terminated."}
