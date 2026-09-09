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

    @staticmethod
    async def multilingual_chatbot_response(
        message: str,
        language: str = "mr",
        history: list = [],
        grounded_data_context: str = ""
    ) -> str:
        """
        Multilingual AI healthcare assistant responding strictly in the requested language
        (Marathi, Hindi, or English) grounded in real SwasthyaSetu data.
        """
        lang_map = {
            "mr": "Marathi (मराठी)",
            "hi": "Hindi (हिंदी)",
            "en": "English"
        }
        lang_name = lang_map.get(language, "Marathi (मराठी)")

        context = ""
        if history:
            clean_history = []
            for h in history[-6:]:  # Keep recent context
                role = h.get("role", "user")
                content = h.get("content") or (h.get("parts", [""])[0] if "parts" in h else "")
                if content:
                    clean_history.append(f"{role.capitalize()}: {content}")
            if clean_history:
                context = "Recent Conversation History:\n" + "\n".join(clean_history) + "\n\n"

        grounding_section = ""
        if grounded_data_context:
            grounding_section = f"""
VERIFIED SWASTHYASETU DATABASE CONTEXT (SOURCE OF TRUTH):
---
{grounded_data_context}
---
CRITICAL GROUNDING DIRECTIVE:
1. You MUST use the verified SwasthyaSetu database information above to answer the user's question accurately.
2. CITE the actual dates, doses, medicine availability, hospital names, or bed numbers from the context.
3. NEVER invent or fabricate data that is not in the database context. If the database indicates no records were found, tell the patient politely in {lang_name} that no matching records were found in their profile or directory.
"""

        prompt = f"""
You are the SwasthyaSetu AI Multilingual Healthcare Assistant (स्वास्थ्यसेतू बहुभाषिक आरोग्य सहाय्यक), an empathetic, highly knowledgeable medical navigation assistant for Indian citizens.

TARGET LANGUAGE: {lang_name}
CRITICAL REQUIREMENT: Your entire response MUST be written fluently, naturally, and warmly in {lang_name}.

{grounding_section}

{context}
User Query: {message}

RESPONSE GUIDELINES:
1. Language: Answer naturally, respectfully, and clearly in {lang_name}. Use appropriate regional terms (e.g. for Marathi: नमस्कार, लसीकरण, औषधोपचार, आरोग्य केंद्र, इ.).
2. Tone: Warm, empathetic, professional, and easily understandable by everyday patients and families.
3. Healthcare Safety: You are an educational and navigation assistant. Clearly state that you do not replace a licensed medical doctor's diagnosis or emergency services (108).
4. Clarity: Use clear formatting, bullet points where helpful, and avoid medical jargon when simpler terms exist. Keep medicine names and dosages exact.
"""
        return await AIService._call_ai(prompt, json_mode=False)

    @staticmethod
    async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm", language: str = "mr") -> tuple:
        """
        Transcribe audio using Groq Whisper-large-v3 with Gemini Multimodal fallback.
        Supports Marathi ('mr'), Hindi ('hi'), English ('en'), or 'auto' for language detection.
        Returns: (transcription_text, detected_language_code)
        """
        auto_detect = (language == "auto")
        lang_code = None if auto_detect else (
            "mr" if language == "mr" else ("hi" if language == "hi" else "en")
        )
        fallback_lang = "mr"  # Default if auto-detect returns nothing
        
        # 1. Try Groq Whisper
        if groq_client:
            try:
                print(f"DEBUG: Transcribing audio with Groq Whisper (lang={lang_code or 'auto-detect'})...")
                create_kwargs = {
                    "file": (filename, audio_bytes),
                    "model": "whisper-large-v3",
                    "response_format": "verbose_json",  # verbose returns detected language
                    "temperature": 0.0
                }
                if lang_code:
                    create_kwargs["language"] = lang_code
                
                transcription = await groq_client.audio.transcriptions.create(**create_kwargs)
                text = str(transcription.text).strip()
                
                # Extract detected language from verbose_json response
                detected_lang = lang_code or fallback_lang
                if hasattr(transcription, "language") and transcription.language:
                    whisper_lang = str(transcription.language).lower()
                    # Map Whisper language codes to our codes
                    if whisper_lang in ("marathi", "mr"):
                        detected_lang = "mr"
                    elif whisper_lang in ("hindi", "hi"):
                        detected_lang = "hi"
                    elif whisper_lang in ("english", "en"):
                        detected_lang = "en"
                    else:
                        detected_lang = lang_code or fallback_lang
                
                if text and len(text) >= 2:
                    print(f"DEBUG: Groq Whisper transcription success ({detected_lang}): {text[:50]}...")
                    return text, detected_lang
                elif not text:
                    return "", detected_lang
            except Exception as e:
                print(f"Groq Whisper error: {e}")

        # 2. Fallback to Gemini Multimodal Audio
        print(f"DEBUG: Falling back to Gemini Multimodal for audio transcription (lang={lang_code or 'auto'})...")
        try:
            mime_type = "audio/webm"
            lower_name = filename.lower()
            if lower_name.endswith(".wav"):
                mime_type = "audio/wav"
            elif lower_name.endswith(".mp3"):
                mime_type = "audio/mp3"
            elif lower_name.endswith(".ogg"):
                mime_type = "audio/ogg"
            elif lower_name.endswith(".m4a"):
                mime_type = "audio/m4a"

            model = genai.GenerativeModel(Config.GEMINI_MODEL)
            lang_display_map = {"mr": "Marathi", "hi": "Hindi", "en": "English"}
            lang_display = lang_display_map.get(lang_code, "Marathi, Hindi, or English (detect automatically)")
            prompt = (
                f"Accurately transcribe the healthcare speech spoken in this audio recording. "
                f"The language spoken is {lang_display}. "
                "Return ONLY the transcribed words. Do not add quotes, commentary, or markdown formatting."
            )
            
            media_part = {
                "mime_type": mime_type,
                "data": audio_bytes
            }
            res = await model.generate_content_async([prompt, media_part])
            text = str(res.text).strip()
            # For auto-detect via Gemini, use client-side detection fallback
            detected = lang_code or fallback_lang
            return text, detected
        except Exception as e:
            print(f"Gemini audio transcription fallback error: {e}")
            raise Exception(f"Voice transcription service unavailable: {str(e)}")

    @staticmethod
    async def explain_simply(medical_text: str, language: str = "mr") -> dict:
        """
        Simplifies doctor instructions, prescriptions, or follow-up notes for patients.
        STRICT SAFETY:
        - NEVER alter medicine names, dosages, vaccine dates, or appointment dates.
        - Only translate/simplify explanatory language into patient-friendly Marathi/Hindi/English.
        """
        lang_map = {
            "mr": "Marathi (मराठी)",
            "hi": "Hindi (हिंदी)",
            "en": "English"
        }
        lang_name = lang_map.get(language, "Marathi (मराठी)")

        prompt = f"""
You are a specialized Medical Simplification and Patient Education AI assistant for SwasthyaSetu.
Your mission is to translate and simplify the following clinical instructions for a patient into plain, reassuring, and completely understandable {lang_name}.

ORIGINAL CLINICAL / DOCTOR TEXT:
\"\"\"{medical_text}\"\"\"

STRICT SAFETY DIRECTIVES:
1. DO NOT CHANGE: Medicine names, dosages (mg, ml, puffs), frequencies (1-0-1, OD, BD, TDS), appointment dates, vaccine dates, diagnostic numbers, or critical doctor orders. These MUST remain exact and uncorrupted.
2. DO SIMPLIFY: The reasons, preparation guidelines, administration tips (e.g. take after food with water), warning signs, and what the patient should do next.
3. OUTPUT LANGUAGE: All simplified text, instructions, and bullet points MUST be strictly in {lang_name}.

RETURN STRICT JSON ONLY IN THIS STRUCTURE:
{{
    "simplified_title": "Short reassuring title in {lang_name}",
    "simplified_explanation": "2-3 simple sentences explaining what the doctor's instructions mean in plain language in {lang_name}",
    "what_you_need_to_do": [
        "Action step 1 in {lang_name}",
        "Action step 2 in {lang_name}"
    ],
    "preserved_critical_details": [
        "Exact medicine / dosage / appointment date extracted without alteration"
    ],
    "when_to_seek_urgent_help": "Simple emergency warning sign in {lang_name}",
    "disclaimer": "This simplified guide is generated by SwasthyaSetu AI for patient understanding. Always follow your physician's exact medical guidance."
}}
"""
        try:
            response_text = await AIService._call_ai(prompt, json_mode=True)
            cleaned = str(response_text).replace("```json", "").replace("```", "").strip()
            res = json.loads(cleaned)
            return res
        except Exception as e:
            print(f"Explain Simply Error: {e}")
            # Fallback deterministic response
            if language == "mr":
                return {
                    "simplified_title": "वैद्यकीय सूचनांचे सोपे स्पष्टीकरण",
                    "simplified_explanation": f"तुमच्या डॉक्टरांच्या मूळ सूचना: {medical_text}. कृपया औषधे डॉक्टरांनी सांगितल्याप्रमाणे वेळेवर घ्या.",
                    "what_you_need_to_do": ["औषध डॉक्टरांच्या सल्ल्यानुसार घ्या", "काही त्रास वाटल्यास जवळच्या डॉक्टरांशी संपर्क साधा"],
                    "preserved_critical_details": [medical_text],
                    "when_to_seek_urgent_help": "अचानक जास्त त्रास झाल्यास लगेच १०८ वर संपर्क करा किंवा रुग्णालयात जा.",
                    "disclaimer": "हे स्पष्टीकरण AI द्वारे सोपे केले आहे. डॉक्टरांच्या मूळ सल्ल्याचे तंतोतंत पालन करा."
                }
            elif language == "hi":
                return {
                    "simplified_title": "चिकित्सा निर्देशों का सरल स्पष्टीकरण",
                    "simplified_explanation": f"आपके डॉक्टर के मूल निर्देश: {medical_text}. कृपया दवाइयां डॉक्टर के निर्देशानुसार समय पर लें।",
                    "what_you_need_to_do": ["दवा डॉक्टर के परामर्श अनुसार लें", "समस्या होने पर तुरंत डॉक्टर से संपर्क करें"],
                    "preserved_critical_details": [medical_text],
                    "when_to_seek_urgent_help": "अधिक परेशानी होने पर तुरंत 108 पर कॉल करें या अस्पताल जाएं।",
                    "disclaimer": "यह व्याख्या AI द्वारा सरल की गई है। डॉक्टर के निर्देशों का पालन करें।"
                }
            else:
                return {
                    "simplified_title": "Simplified Medical Explanation",
                    "simplified_explanation": f"Doctor's original instruction: {medical_text}. Please adhere strictly to the prescribed regimen.",
                    "what_you_need_to_do": ["Take medications as prescribed", "Reach out to your doctor if symptoms persist"],
                    "preserved_critical_details": [medical_text],
                    "when_to_seek_urgent_help": "Seek emergency medical care (108) if severe distress develops.",
                    "disclaimer": "Educational AI explanation. Always follow your doctor's exact instructions."
                }


    @staticmethod
    async def structure_field_note(spoken_text: str, worker_language: str = "mr") -> dict:
        """
        ASHA/ANM Field Note Structuring from voice/text observations.

        CRITICAL SAFETY RULES (enforced in prompt + validated in code):
        1. NEVER diagnoses conditions — only structures what was spoken.
        2. NEVER prescribes medication or changes dosage.
        3. NEVER invents patient data not present in the spoken text.
        4. ALWAYS sets worker_confirmation_required = True.
        5. Returns a structured template for HUMAN REVIEW ONLY.
        6. No data is saved by this method; saving requires frontend confirmation.
        """
        lang_map = {
            "mr": "Marathi (मराठी)",
            "hi": "Hindi (हिंदी)",
            "en": "English"
        }
        lang_name = lang_map.get(worker_language, "Marathi (मराठी)")

        prompt = f"""
You are an ASHA/ANM Field Note Structuring AI for SwasthyaSetu.
Your ONLY job is to extract and organize information that the field worker has ALREADY SPOKEN or typed.

SPOKEN/TYPED FIELD OBSERVATION:
\"\"\"{spoken_text}\"\"\"

STRICT SAFETY DIRECTIVES — MANDATORY:
1. ONLY extract information explicitly present in the spoken text above. Do NOT add, infer, or invent any information not stated.
2. Do NOT diagnose any disease or condition. Your role is purely to organize what the worker observed.
3. Do NOT prescribe, recommend, or change any medication, dosage, or treatment.
4. Do NOT generate appointment dates or vaccination schedules.
5. Always set "worker_confirmation_required" to true.
6. If a field is not mentioned in the spoken text, set it to null or an empty list — never guess.
7. urgency_flag must be based ONLY on explicit urgency indicators in the text (e.g., unconscious, difficulty breathing, seizure → EMERGENCY; high fever, uncontrolled vomiting → URGENT; routine follow-up → ROUTINE).
8. The disclaimer field must always be present and unchanged.
9. All text fields in the output should be in {lang_name}.

RETURN STRICT JSON ONLY:
{{
    "patient_name": "Name if stated, else null",
    "age_approx": "Age if stated, else null",
    "gender": "Gender if stated, else null",
    "village_location": "Village/location if stated, else null",
    "symptoms": ["List of symptoms explicitly mentioned"],
    "vitals_mentioned": {{
        "temperature": "e.g. 101°F if mentioned, else null",
        "blood_pressure": "e.g. 120/80 if mentioned, else null",
        "weight": "Weight if mentioned, else null",
        "pulse": "Pulse if mentioned, else null",
        "spo2": "SpO2 if mentioned, else null"
    }},
    "observations": "Free-text summary of what the worker observed, in {lang_name}",
    "recommended_action": "Only if the worker explicitly stated a recommended action — do NOT generate this independently. null if not mentioned.",
    "urgency_flag": "ROUTINE or URGENT or EMERGENCY — based strictly on symptoms mentioned",
    "worker_confirmation_required": true,
    "disclaimer": "This note was AI-structured from field worker voice observations. It requires mandatory review and confirmation by the ASHA/ANM worker before any clinical use. This is NOT a medical diagnosis and should not replace professional medical evaluation."
}}
"""
        try:
            response_text = await AIService._call_ai(prompt, json_mode=True)
            cleaned = str(response_text).replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned)

            # Safety enforcement: these fields are ALWAYS overridden regardless of AI output
            result["worker_confirmation_required"] = True
            result["disclaimer"] = (
                "This note was AI-structured from field worker voice observations. "
                "It requires mandatory review and confirmation by the ASHA/ANM worker before any clinical use. "
                "This is NOT a medical diagnosis and should not replace professional medical evaluation."
            )

            # Validate urgency_flag
            valid_urgency = {"ROUTINE", "URGENT", "EMERGENCY"}
            if result.get("urgency_flag", "").upper() not in valid_urgency:
                result["urgency_flag"] = "ROUTINE"
            else:
                result["urgency_flag"] = result["urgency_flag"].upper()

            return result

        except Exception as e:
            print(f"structure_field_note AI error: {e}")
            # Deterministic fallback — never fails the worker
            return {
                "patient_name": None,
                "age_approx": None,
                "gender": None,
                "village_location": None,
                "symptoms": [],
                "vitals_mentioned": {
                    "temperature": None, "blood_pressure": None,
                    "weight": None, "pulse": None, "spo2": None
                },
                "observations": spoken_text,
                "recommended_action": None,
                "urgency_flag": "ROUTINE",
                "worker_confirmation_required": True,
                "disclaimer": (
                    "This note was AI-structured from field worker voice observations. "
                    "It requires mandatory review and confirmation by the ASHA/ANM worker before any clinical use. "
                    "This is NOT a medical diagnosis."
                )
            }
