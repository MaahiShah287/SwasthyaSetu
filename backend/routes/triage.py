from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
import time
import re
from utils.jwt_handler import get_current_user
from services.ai_service import AIService

router = APIRouter()


class TriageRequest(BaseModel):
    main_symptom: str = Field(..., description="Main symptom or problem description")
    duration: str = Field(..., description="Duration of symptoms (e.g. 2 hours, 3 days)")
    severity: str = Field("Moderate", description="Severity level: Mild, Moderate, Severe, Extreme")
    age_group: str = Field("Adult", description="Age category: Infant, Child, Teen, Adult, Senior")
    existing_conditions: Optional[str] = Field("", description="Voluntarily provided existing health conditions")
    current_medications: Optional[str] = Field("", description="Voluntarily provided medications")
    pregnancy_status: Optional[str] = Field("", description="Voluntarily provided pregnancy status where relevant")
    other_symptoms: Optional[str] = Field("", description="Additional symptoms or observations")
    location: Optional[str] = Field("", description="City or general area")

RED_FLAG_PATTERNS = [
    # Severe breathing difficulty
    r"(shortness of breath|difficulty breathing|cannot breathe|can't breathe|asphyxia|gasping|suffocating|choking|stridor|severe dyspnea)",
    # Loss of consciousness
    r"(unconscious|passed out|pass out|fainted|fainting|unresponsive|blackout|loss of consciousness|coma|knocked out)",
    # Severe chest symptoms
    r"(chest pain|crushing chest|chest pressure|pressure in chest|heart attack|tightness in chest|pain radiating to arm|pain in left arm)",
    # Uncontrolled bleeding
    r"(uncontrolled bleeding|coughing blood|coughing up blood|vomiting blood|heavy bleeding|hemorrhage|profuse bleeding|spurting blood)",
    # Signs of stroke
    r"(stroke|facial drooping|face droop|slurred speech|sudden weakness|arm weakness|one side paralysis|numbness on one side)",
    # Severe allergic reaction
    r"(anaphylaxis|anaphylactic|swollen tongue|swollen throat|throat closing|severe allergic reaction)",
    # Serious poisoning / overdose
    r"(poison|ingest.*chemical|ingest.*poison|overdose|toxic|swallow.*poison|swallow.*chemical)",

    # Major trauma
    r"(head injury|head trauma|major trauma|stab wound|gunshot|fall from height|severe crash|fracture with bone visible|amputation)"
]

def evaluate_red_flags(request: TriageRequest) -> Optional[dict]:
    combined_text = f"{request.main_symptom} {request.other_symptoms} {request.existing_conditions}".lower()
    
    matched_flags = []
    for pattern in RED_FLAG_PATTERNS:
        match = re.search(pattern, combined_text, re.IGNORECASE)
        if match:
            matched_flags.append(match.group(0))

    # Also check if severity is Extreme or Severe combined with acute chest/breathing/neurological keywords
    if matched_flags or (request.severity in ["Severe", "Extreme"] and any(kw in combined_text for kw in ["chest", "breath", "bleed", "head", "faint", "seizure"])):
        flag_summary = ", ".join(matched_flags) if matched_flags else "High severity acute symptom requiring immediate clinical evaluation."
        return {
            "urgency_level": "EMERGENCY",
            "summary": f"CRITICAL SAFETY WARNING: High-priority emergency indicators detected ({flag_summary}). Immediate emergency medical assistance is strongly advised.",
            "recommended_action": "Call emergency services immediately (108 / 112 / 911) or proceed immediately to the nearest Hospital Emergency Department.",
            "recommended_service_type": "Emergency Room (ER) / Level 1 Trauma Center",
            "warning_signs": [
                "Severe difficulty breathing or gasping for air",
                "Crushing chest pain or pressure radiating to arm/neck",
                "Sudden weakness, facial drooping, or inability to speak",
                "Uncontrolled bleeding or loss of consciousness"
            ],
            "disclaimer": "This is preliminary safety triage guidance and not a medical diagnosis. If you are experiencing a life-threatening emergency, contact emergency medical services immediately."
        }
    return None

@router.post("/assess")
async def assess_health_triage(request: TriageRequest, current_user: dict = Depends(get_current_user)):
    try:
        from database import triage_history_collection
        # Step 1: Deterministic Red-Flag Safety Check
        red_flag_result = evaluate_red_flags(request)
        red_flag_triggered = False
        
        if red_flag_result:
            result = red_flag_result
            red_flag_triggered = True
        else:
            # Step 2: AI Triage Evaluation using existing Gemini/Groq architecture
            request_dict = request.dict()
            result = await AIService.assess_triage(request_dict)
            
        # Step 3: Persist triage record in DB securely tied to user account
        triage_doc = {
            "user_email": current_user["sub"],
            "input": request.dict(),
            "result": result,
            "red_flag_triggered": red_flag_triggered,
            "timestamp": time.time()
        }
        try:
            await triage_history_collection.insert_one(triage_doc)
        except Exception as db_err:
            print(f"Warning: Failed to persist triage record to MongoDB: {db_err}")
        
        # Add metadata flag for response
        result["red_flag_triggered"] = red_flag_triggered
        return result

    except Exception as e:
        print(f"Error in triage assessment route: {e}")
        raise HTTPException(status_code=500, detail="Failed to process triage assessment. Please consult emergency services if you feel unwell.")

@router.get("/history")
async def get_triage_history(current_user: dict = Depends(get_current_user)):
    try:
        from database import triage_history_collection
        cursor = triage_history_collection.find(
            {"user_email": current_user["sub"]}
        ).sort("timestamp", -1).limit(20)
        
        history = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            history.append(doc)
            
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

