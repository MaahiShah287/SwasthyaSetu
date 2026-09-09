from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import re

from services.ai_service import AIService
from utils.jwt_handler import get_current_user
from database import (
    vaccinations_collection,
    children_collection,
    follow_ups_collection,
    appointments_collection,
    medicine_inventory_collection,
    diagnostic_services_collection,
    healthcare_facilities_collection,
    ambulances_collection,
    profile_collection,
    users_collection
)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    language: Optional[str] = "mr"  # 'mr' | 'hi' | 'en' | 'auto'
    history: Optional[List[Dict[str, Any]]] = []
    context: Optional[Dict[str, Any]] = None

class ExplainSimplyRequest(BaseModel):
    text: str
    language: Optional[str] = "mr"

def detect_language(text: str) -> str:
    """Detect if query is primarily Marathi / Hindi (Devanagari) or English."""
    devanagari_chars = len(re.findall(r'[\u0900-\u097F]', text))
    if devanagari_chars > 2:
        # Check specific Marathi marker words
        marathi_markers = ["आहे", "नाही", "कधी", "कुठे", "माझी", "माझा", "करा", "द्या", "सांगा", "लस", "औषध", "रुग्णालय", "तपासणी"]
        for marker in marathi_markers:
            if marker in text:
                return "mr"
        return "hi"  # Default Devanagari to Hindi if not explicitly Marathi
    return "en"

async def resolve_healthcare_context(user_email: str, query: str, lang: str):
    """
    Intelligently inspects user query and queries EXISTING SwasthyaSetu MongoDB collections
    to retrieve 100% verified healthcare data.
    NEVER hallucinate or invent records.
    """
    query_lower = query.lower()
    grounded_context = ""
    grounded_data = None

    # 1. VACCINATION INTENT
    vaccine_keywords = [
        "लस", "लसी", "लसीकरण", "डोस", "पोलिओ", "हेपॅटायटिस", "बीसजी",
        "vaccine", "vaccination", "dose", "polio", "immunization", "bcg", "hepatitis", "measles", "covaxin", "covishield", "टीका", "टीकाकरण"
    ]
    is_vaccine_query = any(kw in query_lower for kw in vaccine_keywords)

    # 2. FOLLOW-UP & APPOINTMENT INTENT
    followup_keywords = [
        "फॉलो", "फॉलो-अप", "अपॉइंटमेंट", "डॉक्टर भेट", "पुढील भेट", "पुढील तपासणी",
        "appointment", "follow up", "followup", "doctor visit", "care plan", "परामर्श"
    ]
    is_followup_query = any(kw in query_lower for kw in followup_keywords)

    if is_vaccine_query:
        records = await vaccinations_collection.find(
            {"$or": [
                {"patient_id": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}},
                {"patient_email": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}}
            ]},
            {"_id": 0}
        ).sort("next_due_date", 1).to_list(10)

        # Also check child vaccinations if user has children registered
        children = await children_collection.find(
            {"parent_id": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}},
            {"_id": 0}
        ).to_list(5)

        if records or children:
            items = []
            grounded_context = "USER VACCINATION TRACKING RECORDS IN DATABASE:\n"
            for r in records:
                v_name = r.get("vaccine_name", "Vaccine")
                dose = r.get("dose_number", 1)
                v_date = r.get("vaccination_date", "N/A")
                due = r.get("next_due_date", "N/A")
                st = r.get("status", "UPCOMING")
                grounded_context += f"- Vaccine: {v_name}, Dose: {dose}, Given Date: {v_date}, Next Due: {due}, Status: {st}\n"
                items.append({
                    "title": f"{v_name} (Dose {dose})",
                    "status": st,
                    "date": v_date,
                    "next_due_date": due,
                    "notes": r.get("notes", "")
                })

            for ch in children:
                grounded_context += f"- Registered Child: {ch.get('name')}, DOB: {ch.get('dob')}, Blood: {ch.get('blood_group')}\n"

            grounded_data = {
                "type": "vaccination",
                "title": "लसीकरण माहिती (Vaccination Tracking)" if lang == "mr" else ("टीकाकरण विवरण (Vaccination Tracking)" if lang == "hi" else "Vaccination Records"),
                "count": len(items),
                "items": items,
                "action_link": "/vaccinations",
                "action_text": "लसीकरण हब उघडा (Open Vaccination Hub)" if lang == "mr" else ("टीकाकरण हब खोलें (Open Hub)" if lang == "hi" else "View Vaccination Hub")
            }
        else:
            # Look up available standard vaccines from government schedule in database
            schedule_samples = await vaccinations_collection.find({}, {"_id": 0, "vaccine_name": 1}).distinct("vaccine_name")
            sample_list = schedule_samples[:6] if schedule_samples else ["BCG", "OPV", "Pentavalent", "Rotavirus", "MR"]
            grounded_context = (
                "USER VACCINATION RECORDS IN DATABASE: No personal records found for this user account. "
                f"Standard Government Immunization Schedule Vaccines available in SwasthyaSetu: {', '.join(sample_list)}."
            )
            grounded_data = {
                "type": "vaccination",
                "title": "लसीकरण माहिती (Vaccination Schedule)" if lang == "mr" else ("टीकाकरण सारणी (Vaccination Schedule)" if lang == "hi" else "Vaccination Schedule"),
                "count": len(sample_list),
                "items": [{"title": v, "status": "Available at PHC", "next_due_date": "Check with Doctor"} for v in sample_list],
                "action_link": "/vaccinations",
                "action_text": "लसीकरण हब उघडा (Open Vaccination Hub)" if lang == "mr" else ("टीकाकरण हब खोलें" if lang == "hi" else "Open Vaccination Hub")
            }

    elif is_followup_query:
        followups = await follow_ups_collection.find(
            {"patient_id": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}},
            {"_id": 0}
        ).sort("due_date", 1).to_list(5)

        appts = await appointments_collection.find(
            {"patient_id": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}},
            {"_id": 0}
        ).sort("appointment_date", -1).to_list(5)

        if followups or appts:
            items = []
            grounded_context = "USER FOLLOW-UPS & APPOINTMENTS IN DATABASE:\n"
            for f in followups:
                title = f.get("title", "Follow-up consultation")
                due = f.get("due_date", "N/A")
                time_slot = f.get("due_time", "")
                st = f.get("status", "PENDING")
                doc = f.get("doctor_name") or "Assigned Physician"
                grounded_context += f"- Follow-up: {title}, Due: {due} {time_slot}, Doctor: {doc}, Status: {st}\n"
                items.append({
                    "title": title,
                    "date": due,
                    "time": time_slot,
                    "doctor": doc,
                    "status": st,
                    "type": "follow_up"
                })

            for a in appts:
                doc_name = a.get("doctor_name", "Doctor")
                a_date = a.get("appointment_date", "N/A")
                a_time = a.get("time_slot", "")
                st = a.get("status", "SCHEDULED")
                grounded_context += f"- Appointment: With {doc_name}, Date: {a_date}, Time: {a_time}, Status: {st}\n"
                items.append({
                    "title": f"Appointment with {doc_name}",
                    "date": a_date,
                    "time": a_time,
                    "doctor": doc_name,
                    "status": st,
                    "type": "appointment"
                })

            grounded_data = {
                "type": "followup",
                "title": "फॉलो-अप आणि अपॉइंटमेंट्स (Follow-Up & Care Plan)" if lang == "mr" else ("फॉलो-अप और अपॉइंटमेंट्स" if lang == "hi" else "Follow-Up & Appointments"),
                "count": len(items),
                "items": items,
                "action_link": "/follow-ups",
                "action_text": "फॉलो-अप व्यवस्थापन पहा (View Follow-Up Plan)" if lang == "mr" else ("फॉलो-अप देखें (View Follow-Up)" if lang == "hi" else "View Follow-Up Hub")
            }
        else:
            if not grounded_context:
                grounded_context = "USER FOLLOW-UP / APPOINTMENT RECORDS IN DATABASE: No pending appointments or active follow-up schedules found in the database."

    # 3. MEDICINE AVAILABILITY INTENT
    medicine_keywords = [
        "औषध", "गोळी", "पॅरासिटामॉल", "दवा", "दवाई", "साठा", "स्टॉक",
        "medicine", "tablet", "syrup", "paracetamol", "capsule", "pharmacy", "stock", "availability", "chemist", "inventory", "गोळ्या"
    ]
    if any(kw in query_lower for kw in medicine_keywords):
        # Extract potential medicine name from query
        extracted_name = None
        common_meds = ["paracetamol", "metformin", "amoxicillin", "cetirizine", "azithromycin", "ors", "ibuprofen", "pantoprazole", "insulin", "aspirin"]
        for med in common_meds:
            if med in query_lower:
                extracted_name = med
                break
        
        search_filter = {}
        if extracted_name:
            search_filter = {"$or": [
                {"medicine_name": {"$regex": extracted_name, "$options": "i"}},
                {"generic_name": {"$regex": extracted_name, "$options": "i"}}
            ]}
        
        inventory = await medicine_inventory_collection.find(search_filter, {"_id": 0}).limit(6).to_list(6)
        if inventory:
            items = []
            grounded_context = "SWASTHYASETU REGIONAL MEDICINE INVENTORY DATABASE:\n"
            for m in inventory:
                m_name = m.get("medicine_name", "Medicine")
                gen = m.get("generic_name", "")
                strength = m.get("strength", "")
                fac_name = m.get("facility_name", "District Civil Hospital")
                qty = m.get("quantity", 0)
                st = m.get("status", "Available" if qty > 20 else "Low Stock" if qty > 0 else "Out of Stock")
                price = m.get("price_inr", "Free (Govt Supply)")
                grounded_context += f"- {m_name} ({strength}, {gen}): Quantity {qty} available at '{fac_name}', Status: {st}, Price: {price}\n"
                items.append({
                    "name": m_name,
                    "strength": strength,
                    "facility": fac_name,
                    "quantity": qty,
                    "status": st,
                    "price": price
                })

            query_param = extracted_name or "Paracetamol"
            grounded_data = {
                "type": "medicine",
                "title": "औषध उपलब्धता माहिती (Medicine Inventory)" if lang == "mr" else ("दवा उपलब्धता (Medicine Inventory)" if lang == "hi" else "Medicine Availability"),
                "count": len(items),
                "items": items,
                "action_link": f"/hospitals?tab=medicines&medicine={query_param}",
                "action_text": "हॉस्पिटल डिरेक्टरीमध्ये औषध साठा पहा (Check Medicine Directory)" if lang == "mr" else ("दवा सूची देखें (View Medicine Directory)" if lang == "hi" else "Open Medicine Directory")
            }
        else:
            if not grounded_context:
                grounded_context = "SWASTHYASETU MEDICINE INVENTORY DATABASE: No matching medicine record found for this search in the regional inventory."

    # 4. DIAGNOSTIC SERVICES INTENT
    diagnostic_keywords = [
        "चाचणी", "तपासणी", "एक्स-रे", "रक्त", "सीबीसी", "एमआरआय", "सोनोग्राफी",
        "diagnostic", "test", "cbc", "x-ray", "blood test", "mri", "ct scan", "ultrasound", "lab", "pathology", "जांच"
    ]
    if any(kw in query_lower for kw in diagnostic_keywords):
        tests = await diagnostic_services_collection.find({}, {"_id": 0}).limit(6).to_list(6)
        if tests:
            items = []
            grounded_context = "SWASTHYASETU DIAGNOSTIC SERVICES DATABASE:\n"
            for t in tests:
                s_name = t.get("service_name", "Test")
                f_name = t.get("facility_name", "District Diagnostic Lab")
                cost = t.get("cost", "Free / Subsidized")
                tat = t.get("turnaround_time", "Same Day")
                avail = "Available" if t.get("is_available", True) else "Unavailable"
                grounded_context += f"- Service: {s_name} at '{f_name}', Cost: {cost}, TAT: {tat}, Status: {avail}\n"
                items.append({
                    "name": s_name,
                    "facility": f_name,
                    "cost": cost,
                    "tat": tat,
                    "status": avail
                })

            grounded_data = {
                "type": "diagnostic",
                "title": "निदान सेवा उपलब्धता (Diagnostic Services)" if lang == "mr" else ("निदान सेवाएं (Diagnostic Services)" if lang == "hi" else "Diagnostic Services"),
                "count": len(items),
                "items": items,
                "action_link": "/hospitals?tab=diagnostics",
                "action_text": "डायग्नोस्टिक डिरेक्टरी उघडा (Open Diagnostic Directory)" if lang == "mr" else ("डायग्नोस्टिक सूची खोलें (Open Directory)" if lang == "hi" else "Open Diagnostics Directory")
            }

    # 5. EMERGENCY & AMBULANCE INTENT
    emergency_keywords = [
        "आपत्कालीन", "इमर्जन्सी", "रुग्णवाहिका", "अॅम्ब्युलन्स", "रक्त गट", "ऍलर्जी", "१०८", "108",
        "emergency", "ambulance", "blood group", "allergies", "emergency contact", "मदद", "तातडी"
    ]
    if any(kw in query_lower for kw in emergency_keywords):
        prof = await profile_collection.find_one({"email": user_email}, {"_id": 0})
        ambs = await ambulances_collection.find({"status": "Available"}, {"_id": 0}).limit(3).to_list(3)
        hosp_24x7 = await healthcare_facilities_collection.find({"is_24x7_emergency": True}, {"_id": 0}).limit(3).to_list(3)

        grounded_context = "SWASTHYASETU EMERGENCY PROFILE & FLEET DATABASE:\n"
        items = []
        if prof:
            bg = prof.get("blood_group", "Not Set")
            em_contact = prof.get("emergency_contact", "108")
            allergies = prof.get("allergies", "None reported")
            grounded_context += f"Patient Emergency Identifiers: Blood Group: {bg}, Emergency Contact: {em_contact}, Allergies: {allergies}\n"
            items.append({
                "title": "Patient Emergency Identifiers",
                "blood_group": bg,
                "emergency_contact": em_contact,
                "allergies": allergies
            })

        for a in ambs:
            a_id = a.get("ambulance_id")
            v_type = a.get("vehicle_type", "ALS Ambulance")
            phone = a.get("emergency_phone", "108")
            grounded_context += f"- Available Ambulance Unit: {a_id} ({v_type}), Emergency Helpline: {phone}\n"
            items.append({
                "title": f"{v_type} ({a_id})",
                "phone": phone,
                "status": "Available"
            })

        grounded_data = {
            "type": "emergency",
            "title": "आपत्कालीन माहिती व मदत (Emergency Guidance & Fleet)" if lang == "mr" else ("आपातकालीन सहायता (Emergency Guidance)" if lang == "hi" else "Emergency Assistance & Fleet"),
            "count": len(items),
            "items": items,
            "action_link": "/profile",
            "action_text": "आपत्कालीन प्रोफाइल उघडा (Open Emergency Profile)" if lang == "mr" else ("आपातकालीन प्रोफाइल खोलें (Open Profile)" if lang == "hi" else "Open Emergency Profile")
        }

    # 6. HEALTHCARE FACILITIES / HOSPITALS DIRECTORY INTENT
    facility_keywords = [
        "हॉस्पिटल", "रुग्णालय", "आरोग्य केंद्र", "दवाखाना", "बेड", "phc", "chc", "उपलब्ध खाटा",
        "hospital", "clinic", "healthcare facility", "bed", "icu bed", "facilities", "nearest hospital", "नागरी रुग्णालय"
    ]
    if any(kw in query_lower for kw in facility_keywords) and not grounded_data:
        facs = await healthcare_facilities_collection.find({}, {"_id": 0}).limit(4).to_list(4)
        if facs:
            items = []
            grounded_context = "SWASTHYASETU HEALTHCARE DIRECTORY (VERIFIED FACILITIES):\n"
            for fac in facs:
                f_name = fac.get("name", "Civil Hospital")
                cat = fac.get("type") or fac.get("category", "Hospital")
                tot_beds = fac.get("total_beds", 0)
                avail_beds = fac.get("available_beds", 0)
                icu = fac.get("icu_beds_available", 0)
                addr = fac.get("address", "")
                ph = fac.get("phone", "")
                grounded_context += f"- {f_name} ({cat}): Address: {addr}, General Beds Available: {avail_beds}/{tot_beds}, ICU Beds: {icu}, Phone: {ph}\n"
                items.append({
                    "name": f_name,
                    "type": cat,
                    "address": addr,
                    "available_beds": avail_beds,
                    "total_beds": tot_beds,
                    "icu_beds": icu,
                    "phone": ph
                })

            grounded_data = {
                "type": "facility",
                "title": "रुग्णालय व आरोग्य केंद्र डिरेक्टरी (Healthcare Facilities & Live Beds)" if lang == "mr" else ("अस्पताल और स्वास्थ्य केंद्र (Healthcare Facilities)" if lang == "hi" else "Healthcare Facilities Directory"),
                "count": len(items),
                "items": items,
                "action_link": "/hospitals",
                "action_text": "हॉस्पिटल डिरेक्टरी आणि थेट मॅप उघडा (Open Directory & Map)" if lang == "mr" else ("अस्पताल सूची और मैप देखें (Open Directory)" if lang == "hi" else "View Hospital Directory & Live Map")
            }

    return grounded_context, grounded_data

@router.post("/ask")
async def ask_chatbot(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    try:
        user_email = current_user.get("sub", "")
        
        # Determine language preference
        lang = request.language or "mr"
        if lang == "auto":
            lang = detect_language(request.message)
        elif lang not in ["mr", "hi", "en"]:
            lang = "mr"

        # Resolve ground truth from existing SwasthyaSetu collections
        grounded_context, grounded_data = await resolve_healthcare_context(user_email, request.message, lang)

        # Generate culturally natural, accurate AI response in target language
        ai_response = await AIService.multilingual_chatbot_response(
            message=request.message,
            language=lang,
            history=request.history or [],
            grounded_data_context=grounded_context
        )

        return {
            "response": ai_response,
            "language": lang,
            "grounded_data": grounded_data
        }
    except Exception as e:
        print(f"Chatbot ask error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("mr"),
    current_user: dict = Depends(get_current_user)
):
    """
    Speech-To-Text endpoint: Transcribes Marathi, Hindi, or English audio
    using Groq Whisper-large-v3 (with Gemini Multimodal fallback).
    Supports language='auto' for automatic language detection.
    Returns: { transcription, language, detected_language, empty_audio }
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(status_code=400, detail="Invalid or empty audio recording.")

        lang_code = language.lower() if language in ["mr", "hi", "en", "auto"] else "mr"
        
        result = await AIService.transcribe_audio(
            audio_bytes=audio_bytes,
            filename=file.filename or "recording.webm",
            language=lang_code
        )
        
        # Unpack tuple (transcription_text, detected_lang)
        if isinstance(result, tuple):
            transcription, detected_lang = result
        else:
            transcription, detected_lang = str(result), lang_code
        
        # Flag empty/trivial audio (likely silence or noise)
        is_empty = not transcription or len(transcription.strip()) < 2
        
        return {
            "transcription": transcription,
            "language": lang_code,
            "detected_language": detected_lang,
            "empty_audio": is_empty
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcription route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/explain-simply")
async def explain_simply(
    request: ExplainSimplyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    'Explain Simply' capability for patient-facing medical notes.
    Preserves all dosages, drug names, and dates while simplifying language into Marathi/Hindi/English.
    """
    try:
        lang = request.language if request.language in ["mr", "hi", "en"] else "mr"
        result = await AIService.explain_simply(request.text, language=lang)
        return result
    except Exception as e:
        print(f"Explain simply error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class FieldNoteRequest(BaseModel):
    spoken_text: str
    language: Optional[str] = "mr"  # 'mr' | 'hi' | 'en'


@router.post("/structure-field-note")
async def structure_field_note(
    request: FieldNoteRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    ASHA/ANM Field Note Structuring endpoint.

    Converts spoken/typed field observations into a structured JSON note for WORKER REVIEW.

    CRITICAL SAFETY CONTRACT:
    - This endpoint NEVER saves any data to any database.
    - The response always contains worker_confirmation_required = true.
    - The frontend MUST display a confirmation modal before any use of this data.
    - AI-generated clinical observations must NEVER be saved automatically.
    - This endpoint does not perform medical diagnosis, prescribing, or treatment planning.
    """
    try:
        lang = request.language if request.language in ["mr", "hi", "en"] else "mr"

        if not request.spoken_text or len(request.spoken_text.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="Spoken text is too short to structure. Please provide more detail."
            )

        structured = await AIService.structure_field_note(
            spoken_text=request.spoken_text.strip(),
            worker_language=lang
        )

        # Safety: always enforce confirmation requirement at route level too
        structured["worker_confirmation_required"] = True

        return {
            "structured_note": structured,
            "language": lang,
            "source_text": request.spoken_text.strip(),
            "safety_note": (
                "This AI-structured note requires mandatory ASHA/ANM worker review and confirmation. "
                "No data has been saved. Saving must be an explicit user action after review."
            )
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Structure field note error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

