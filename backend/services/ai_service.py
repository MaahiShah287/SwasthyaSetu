import json
import time
import asyncio
from groq import AsyncGroq
import google.generativeai as genai
from config import Config

# Initialize Clients
groq_client = AsyncGroq(api_key=Config.GROQ_API_KEY) if Config.GROQ_API_KEY else None
if Config.GOOGLE_API_KEY:
    genai.configure(api_key=Config.GOOGLE_API_KEY)

# Simple Cache for Suggestions
suggestions_cache = {}

class AIService:
    @staticmethod
    async def _call_ai(prompt: str, json_mode: bool = False, retries: int = 1):
        """Helper to call Groq with Gemini fallback and retry logic"""
        
        groq_models_to_try = [
            "groq/compound",
            "qwen/qwen3.8-27b",
            "groq/compound-mini",
            Config.GROQ_MODEL
        ]
        # Deduplicate while preserving order
        groq_models = []
        for m in groq_models_to_try:
            if m and m not in groq_models:
                groq_models.append(m)

        # 1. Try Groq across candidate model aliases
        if groq_client:
            for model_name in groq_models:
                try:
                    print(f"DEBUG: Calling Groq ({model_name})...")
                    response_format = {"type": "json_object"} if json_mode else None
                    completion = await groq_client.chat.completions.create(
                        model=model_name,
                        messages=[{"role": "user", "content": prompt}],
                        response_format=response_format,
                        timeout=8.0
                    )
                    return str(completion.choices[0].message.content)
                except Exception as e:
                    print(f"Groq ({model_name}) Error: {e}")
                    continue
        
        # 2. Fallback to Gemini
        print(f"DEBUG: Falling back to Gemini ({Config.GEMINI_MODEL})...")
        try:
            model = genai.GenerativeModel(Config.GEMINI_MODEL)
            gemini_prompt = prompt
            if json_mode and "json" not in prompt.lower():
                gemini_prompt += "\nReturn strictly valid JSON."
            
            response = await model.generate_content_async(gemini_prompt)
            text = str(response.text).strip()
            # Basic cleanup for Gemini's markdown response
            if json_mode:
                text = text.replace('```json', '').replace('```', '').strip()
            return text
        except Exception as e:
            print(f"Gemini Fallback Error: {e}")
            raise Exception(f"AI Service Error: {str(e)}")

    @staticmethod
    async def refine_problem(description: str):
        prompt = f"""
        Act as a professional healthcare research consultant. 
        Refine the following healthcare problem statement into a structured research format.
        
        Original Problem: {description}
        
        Format the response strictly in JSON with these keys:
        - context: Background information
        - population: Who is affected
        - impact: How it affects healthcare
        - research_direction: Suggested areas for study
        """
        response = await AIService._call_ai(prompt, json_mode=True)
        try:
            return json.loads(response)
        except:
            # Fallback structure if JSON fails
            return {
                "context": "Healthcare innovation required.",
                "population": "General patients",
                "impact": "High",
                "research_direction": "Further analysis needed"
            }

    @staticmethod
    async def generate_ideas(problem_text: str):
        prompt = f"""
        Based on this healthcare problem: "{problem_text}", 
        generate 3-5 intelligent, innovative solution ideas.
        
        Format as a JSON list of objects:
        - title: Name of the idea
        - description: One-sentence explanation
        - feasibility: Number from 0 to 100
        - explanation: Short technical rationale (Scientific basis)
        """
        response = await AIService._call_ai(prompt, json_mode=True)
        try:
            return json.loads(response)
        except:
            return [{"title": "Innovation Concept", "description": "AI-driven approach", "feasibility": 50, "explanation": "Requires validation"}]

    @staticmethod
    async def analyze_claim(text: str):
        prompt = f"""
        You are a strict JSON API that analyzes text extracted from uploaded PDF documents.
        Your job is to analyze the document and return structured JSON data that will be used directly in a frontend dashboard.

        CRITICAL RULES:
        1. You MUST return ONLY valid JSON.
        2. Do NOT include explanations outside the JSON.
        3. Do NOT include markdown formatting.
        4. Do NOT include ```json blocks.
        5. Do NOT add any text before or after the JSON.
        6. Every field must always exist in the response.

        If information is missing, return "Not found".

        ---
        TEXT TO ANALYZE:
        {text}

        ---
        ANALYSIS TASKS:
        1. Document classification (Medical Report, Insurance Claim, Prescription, Lab Report, Hospital Discharge Summary, Research Paper, Legal Document, Other).
        2. Document gist (3–5 simple sentences).
        3. Key information extraction (Patient Name, Hospital Name, Doctor Name, Diagnosis, Treatment, Prescription, Claim Amount, Dates, Medical Procedures).
        4. Key points (3–6 bullet points).
        5. AI writing detection (AI probability percentage, Human probability percentage, Short explanation).
        6. Similarity analysis (Compute overall similarity percentage and matched sections).
        7. Risk indicators (High claim amounts, Missing signatures, Missing reports, Contradictions).
        8. Final insight (Short overall assessment).

        ---
        RETURN STRICT JSON USING THIS STRUCTURE:
        {{
            "document_type": "",
            "document_gist": "",
            "key_points": [],
            "entities": {{
                "patient_name": "",
                "hospital_name": "",
                "doctor_name": "",
                "diagnosis": "",
                "treatment": "",
                "prescription": "",
                "claim_amount": "",
                "dates": "",
                "medical_procedures": ""
            }},
            "ai_writing_detection": {{
                "ai_probability": "",
                "human_probability": "",
                "reason": ""
            }},
            "similarity_analysis": {{
                "similarity_score": "",
                "matched_sections": []
            }},
            "risk_indicators": [],
            "final_insight": ""
        }}
        """
        response_text = await AIService._call_ai(prompt, json_mode=True)
        try:
            # Cleanup common AI artifacts just in case
            cleaned = str(response_text).replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned)
        except Exception as e:
            print(f"CRITICAL: Final AI Response Parsing Failed: {e}")
            return {
                "document_type": "Analysis Error",
                "document_gist": "AI response format was invalid. Please retry.",
                "final_insight": str(e)
            }

    @staticmethod
    async def chatbot_response(message: str, history: list = []):
        # Simplistic history handling for now
        context = ""
        if history:
            context = "Context history:\n" + "\n".join([f"{h.get('role')}: {h.get('parts', [''])[0]}" for h in history if 'parts' in h])
        
        prompt = f"""{context}\nUser: {message}\nYou are SwasthyaSetu AI, a professional healthcare assistant. Assist the user with healthcare questions and platform guidance. Use markdown and be concise."""
        return await AIService._call_ai(prompt, json_mode=False)

    @staticmethod
    async def generate_suggestions(text: str, context: str):
        if not text or len(text) < 3:
            return []

        cache_key = f"{text.lower()}_{context.lower()}"
        if cache_key in suggestions_cache:
            return suggestions_cache[cache_key]

        # 1. Local Fallback Generator (Guarantees immediate high-quality medical results)
        def get_local_fallbacks(query: str):
            # Clean query to avoid repetitive prefixes
            prefixes = ["ai-powered", "remote", "predictive", "hospital", "smart", "advanced", "digital"]
            clean_query = query
            low_query = query.lower()
            
            # If query already starts with one of our prefixes, don't re-prefix it in a loop
            for p in prefixes:
                if low_query.startswith(p):
                    # If it's already structured, just give variety
                    return [
                        f"{query} integration",
                        f"{query} optimization",
                        f"{query} compliance audit",
                        f"Scalable {query} architecture",
                        f"Secure {query} implementation"
                    ][:5]

            templates = [
                f"AI-powered {query} detection system",
                f"Remote {query} monitoring solution",
                f"Predictive {query} early warning model",
                f"Hospital {query} workflow automation",
                f"Smart {query} health analytics platform",
                f"Advanced {query} clinical research",
                f"Digital {query} management tool"
            ]
            return templates[:6]

        prompt = f"""
        Act as a medical search engine stabilizer. 
        Generate 5 intelligent, professional, and diverse medical search suggestions starting with or related to: "{text}".
        Context of search: {context}.
        
        RULES:
        1. Return ONLY a valid JSON list of strings.
        2. Do NOT include markdown blocks.
        3. Do NOT include explanations.
        4. Focus on professional healthcare and clinical innovation.
        """
        
        suggestions = []
        try:
            response_text = await AIService._call_ai(prompt, json_mode=True)
            # Basic cleanup for common AI response artifacts
            cleaned = str(response_text).replace("```json", "").replace("```", "").strip()
            suggestions = json.loads(cleaned)
            if not isinstance(suggestions, list):
                suggestions = []
        except Exception as e:
            print(f"DEBUG: AI Suggestion API failed: {e}")
            suggestions = []

        # 2. Merge and Filter
        # Ensure we have at least 5 suggestions by mixing AI and local fallbacks
        if len(suggestions) < 5:
            fallbacks = get_local_fallbacks(text)
            for f in fallbacks:
                if f not in suggestions:
                    suggestions.append(f)
                if len(suggestions) >= 7:
                    break

        final_suggestions = suggestions[:5]
        suggestions_cache[cache_key] = final_suggestions
        return final_suggestions

    @staticmethod
    async def assess_triage(data: dict):
        """
        Evaluate symptom data for preliminary healthcare triage only.
        MUST NOT claim to diagnose diseases.
        Returns structured JSON with fields:
        urgency_level, summary, recommended_action, recommended_service_type, warning_signs, disclaimer
        """
        prompt = f"""
You are a medical triage AI assistant for preliminary healthcare navigation.
CRITICAL SAFETY DIRECTIVE:
1. You MUST NOT claim to provide a medical diagnosis or prescribe medications.
2. Provide ONLY preliminary urgency evaluation and healthcare navigation recommendations.
3. Your output MUST be strictly valid JSON.

USER SYMPTOM INPUT:
- Main Symptom / Problem: {data.get('main_symptom', 'Unspecified')}
- Duration: {data.get('duration', 'Unspecified')}
- Severity: {data.get('severity', 'Moderate')}
- Age Group: {data.get('age_group', 'Adult')}
- Relevant Existing Conditions: {data.get('existing_conditions') or 'None reported'}
- Current Medications: {data.get('current_medications') or 'None reported'}
- Pregnancy Status: {data.get('pregnancy_status') or 'N/A'}
- Other Symptoms: {data.get('other_symptoms') or 'None'}
- Location: {data.get('location') or 'Not provided'}

EVALUATION CRITERIA:
Assign one of the four exact urgency levels:
1. "EMERGENCY": Immediate danger, severe acute onset, high distress, potential life threat.
2. "URGENT": Prompt medical care required within 12-24 hours, non-life-threatening but severe or worsening.
3. "ROUTINE": Scheduled primary care consultation needed within a few days.
4. "SELF-CARE / INFORMATION": Mild symptoms manageable at home with rest, hydration, and monitoring.

RETURN STRICT JSON FORMAT ONLY:
{{
    "urgency_level": "EMERGENCY",
    "summary": "Concise preliminary triage summary (1-2 sentences)",
    "recommended_action": "Clear, actionable healthcare navigation step",
    "recommended_service_type": "Suggested facility type (e.g. Emergency Room, Urgent Care Clinic, Primary Care Physician, Telehealth)",
    "warning_signs": ["Bullet list of red-flag symptoms requiring immediate emergency care if they develop"],
    "disclaimer": "This is preliminary triage guidance and not a medical diagnosis. If you experience severe or life-threatening symptoms, contact emergency services (108/112/911) immediately."
}}
"""
        try:
            response_text = await AIService._call_ai(prompt, json_mode=True)
            cleaned = str(response_text).replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned)
            
            # Ensure standard fields
            if "urgency_level" not in result or result["urgency_level"] not in ["EMERGENCY", "URGENT", "ROUTINE", "SELF-CARE / INFORMATION"]:
                urg = str(result.get("urgency_level", "")).upper()
                if "EMERGENCY" in urg:
                    result["urgency_level"] = "EMERGENCY"
                elif "URGENT" in urg:
                    result["urgency_level"] = "URGENT"
                elif "ROUTINE" in urg:
                    result["urgency_level"] = "ROUTINE"
                else:
                    result["urgency_level"] = "SELF-CARE / INFORMATION"

            if "disclaimer" not in result or not result["disclaimer"]:
                result["disclaimer"] = "This is preliminary triage guidance and not a medical diagnosis. For severe or life-threatening symptoms, contact emergency services immediately."
            
            if "warning_signs" not in result or not isinstance(result["warning_signs"], list):
                result["warning_signs"] = ["Chest pain or shortness of breath", "Sudden weakness or fainting", "Uncontrolled bleeding"]

            result["is_ai_fallback"] = False
            return result
        except Exception as e:
            print(f"Triage AI assessment error: {e}")
            
            # Deterministic fallback based on reported severity & symptoms
            symptom_text = str(data.get('main_symptom', '')).lower()
            severity_text = str(data.get('severity', 'Moderate')).lower()
            
            is_mild = severity_text == 'mild' or any(kw in symptom_text for kw in ['mild', 'fever', 'tired', 'cold', 'cough', 'headache', 'runny nose', 'fatigue'])
            
            urgency = "SELF-CARE / INFORMATION" if is_mild else "URGENT"
            rec_action = "Rest, hydrate, and monitor symptoms at home. Consult a GP if symptoms worsen." if is_mild else "Please consult a healthcare professional or primary care physician for evaluation."
            rec_service = "General consultation" if is_mild else "Primary Care Clinic / Urgent Care"
            
            return {
                "urgency_level": urgency,
                "summary": "AI assessment service temporarily unavailable — deterministic safety guidance shown for your symptoms.",
                "recommended_action": rec_action,
                "recommended_service_type": rec_service,
                "warning_signs": [
                    "High persistent fever above 102°F (38.9°C)",
                    "Difficulty breathing or chest tightness",
                    "Sudden weakness, numbness, or fainting"
                ],
                "disclaimer": "This is preliminary triage guidance only and not a medical diagnosis. If you feel your condition is critical, call emergency services (108 / 112) immediately.",
                "is_ai_fallback": True
            }

    @staticmethod
    async def determine_required_services(triage_result: dict, user_input: dict) -> dict:
        """
        Map triage evaluation & symptoms to standardized healthcare service categories.
        IMPORTANT: The AI selects the required service category; facility matching & availability
        are determined strictly from database facility records.
        """
        prompt = f"""
You are a healthcare navigation AI assistant.
Your task is to identify the primary required healthcare service category for a patient based on triage findings.

AVAILABLE SERVICE TYPES (Select ONE primary service from this list):
- "Emergency care"
- "General consultation"
- "Pediatric care"
- "Women's health"
- "Diagnostic testing"
- "Laboratory services"
- "Specialist consultation"
- "Pharmacy"
- "Referral to higher-level hospital"
- "Telemedicine"

TRIAGE ASSESSMENT:
- Urgency Level: {triage_result.get('urgency_level', 'URGENT')}
- Triage Summary: {triage_result.get('summary', '')}
- Recommended Service Type: {triage_result.get('recommended_service_type', '')}

PATIENT SYMPTOMS & CONTEXT:
- Main Symptom: {user_input.get('main_symptom', '')}
- Other Symptoms: {user_input.get('other_symptoms', '')}
- Age Group: {user_input.get('age_group', 'Adult')}
- Pregnancy Status: {user_input.get('pregnancy_status', 'N/A')}

RETURN STRICT JSON ONLY:
{{
    "primary_required_service": "Exact item from the AVAILABLE SERVICE TYPES list",
    "secondary_services": ["List of 1-2 additional relevant services from the list if applicable"],
    "is_telemedicine_suitable": true/false,
    "specialty_needed": "Name of specialty if specialist required (e.g. Cardiologist, Gynecologist, Pediatrician, Neurologist) or null",
    "clinical_rationale": "1-2 sentence explanation of why this service category was chosen based on symptoms"
}}
"""
        try:
            response_text = await AIService._call_ai(prompt, json_mode=True)
            cleaned = str(response_text).replace("```json", "").replace("```", "").strip()
            res = json.loads(cleaned)
            if "primary_required_service" not in res:
                res["primary_required_service"] = "General consultation"
            return res
        except Exception as e:
            print(f"Error determining required services: {e}")
            urgency = triage_result.get("urgency_level", "ROUTINE")
            primary = "Emergency care" if urgency == "EMERGENCY" else "General consultation"
            return {
                "primary_required_service": primary,
                "secondary_services": ["Telemedicine"] if urgency in ["ROUTINE", "SELF-CARE / INFORMATION"] else [],
                "is_telemedicine_suitable": urgency in ["ROUTINE", "SELF-CARE / INFORMATION"],
                "specialty_needed": None,
                "clinical_rationale": "Selected based on symptom urgency level."
            }

    @staticmethod
    async def explain_followup_instructions(doctor_instructions: str, purpose: str = "", title: str = "") -> dict:
        """
        Simplify doctor's follow-up instructions into clear, patient-friendly guidance.
        STRICT SAFETY RULES:
        - Must NOT decide follow-up dates or whether follow-up is medically required.
        - Must NOT alter prescriptions or medical treatment plans.
        - Must NOT generate autonomous referrals.
        """
        prompt = f"""
You are a empathetic medical education AI assistant for SwasthyaSetu AI.
Your goal is to convert doctor-written instructions into simple, clear, encouraging, patient-friendly terms.

DOCTOR INSTRUCTIONS:
{doctor_instructions}

FOLLOW-UP PURPOSE:
{purpose or title or 'General Follow-Up'}

STRICT SAFETY DIRECTIVES:
1. You MUST NOT change or recommend new follow-up dates.
2. You MUST NOT alter prescriptions, dosages, or clinical treatment plans.
3. You MUST NOT diagnose or create medical referrals.
4. Focus purely on clarifying terminology, listing preparation steps, and encouraging compliance with doctor orders.

RETURN STRICT JSON ONLY:
{{
    "simplified_explanation": "Clear, plain-language explanation of what the doctor's instructions mean (2-3 sentences)",
    "actionable_steps": ["Step 1 for patient preparation or follow-through", "Step 2"],
    "key_reminders": ["Important reminder or thing to bring"],
    "disclaimer": "This explanation is created by AI to help you understand your doctor's instructions. Always follow your doctor's official advice and call your doctor if you have medical questions."
}}
"""
        try:
            response_text = await AIService._call_ai(prompt, json_mode=True)
            cleaned = str(response_text).replace("```json", "").replace("```", "").strip()
            res = json.loads(cleaned)
            if "simplified_explanation" not in res:
                res["simplified_explanation"] = f"Your doctor recommended a follow-up for: {purpose or title}. Please follow the instructions as advised: {doctor_instructions}"
            if "disclaimer" not in res:
                res["disclaimer"] = "AI assistance provided for educational clarification only. Follow official doctor instructions."
            return res
        except Exception as e:
            print(f"Error in explain_followup_instructions AI: {e}")
            return {
                "simplified_explanation": f"Summary of doctor instructions: {doctor_instructions}",
                "actionable_steps": ["Follow prescribed care plan", "Bring relevant medical reports to your follow-up appointment"],
                "key_reminders": ["Arrive 10 minutes before your scheduled follow-up time"],
                "disclaimer": "Educational AI summary. Always follow your physician's exact medical guidance."
            }



