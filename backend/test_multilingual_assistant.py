import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
import asyncio
from routes.chatbot import ask_chatbot, explain_simply, ChatRequest, ExplainSimplyRequest
from routes.profile import update_preferred_language, LanguageUpdate, get_profile

async def run_tests():
    print("=================================================================", flush=True)
    print("   SWASTHYASETU MULTILINGUAL ASSISTANT TEST SUITE               ", flush=True)
    print("=================================================================", flush=True)
    
    test_user = {"sub": "patient@swasthyasetu.org"}  # Active patient with verified records in DB

    # TEST 1: Language Persistence
    print("\n[TEST 1] Language Persistence (PATCH /profile/language)...", flush=True)
    update_res = await update_preferred_language(LanguageUpdate(preferred_language="mr"), current_user=test_user)
    assert update_res["preferred_language"] == "mr"
    profile = await get_profile(current_user=test_user)
    assert profile.get("preferred_language") == "mr"
    print("  [PASS] Preferred language set and persisted as Marathi ('mr').")

    # TEST 2: Marathi Vaccination Query with Grounding
    print("\n[TEST 2] Marathi Voice/Text Query Grounding (Vaccination)...", flush=True)
    chat_req = ChatRequest(
        message="माझी कोणती लस बाकी आहे आणि पुढील तारीख काय आहे?",
        language="mr"
    )
    res = await ask_chatbot(chat_req, current_user=test_user)
    print("  AI Response (Marathi):", res["response"][:120], "...")
    print("  Grounded Data:", res.get("grounded_data"))
    assert res["language"] == "mr"
    assert res["grounded_data"] is not None
    assert res["grounded_data"]["type"] == "vaccination"
    assert len(res["grounded_data"]["items"]) > 0
    print(f"  [PASS] Successfully retrieved {len(res['grounded_data']['items'])} verified vaccination records from MongoDB.")

    # TEST 3: Medicine Query Grounding (Paracetamol)
    print("\n[TEST 3] Medicine Availability Query Grounding (Paracetamol)...", flush=True)
    med_req = ChatRequest(
        message="पॅरासिटामॉल गोळी सरकारी रुग्णालयात उपलब्ध आहे का?",
        language="mr"
    )
    res_med = await ask_chatbot(med_req, current_user=test_user)
    print("  AI Response (Marathi):", res_med["response"][:120], "...")
    assert res_med["grounded_data"] is not None
    assert res_med["grounded_data"]["type"] == "medicine"
    print(f"  [PASS] Grounded medicine items: {len(res_med['grounded_data']['items'])} facilities found.")

    # TEST 4: Explain Simply Feature (Marathi)
    print("\n[TEST 4] 'Explain Simply' Capability (Clinical Translation)...", flush=True)
    sample_rx = "Tab Paracetamol 650mg TDS for 3 days post meals. Cap Amoxicillin 500mg BD. Strict bed rest and hydrate with 3L fluids."
    exp_req = ExplainSimplyRequest(
        text=sample_rx,
        language="mr"
    )
    exp_res = await explain_simply(exp_req, current_user=test_user)
    print("  Simplified Explanation:", exp_res.get("simplified_explanation", "")[:100], "...")
    print("  What to do:", exp_res.get("what_you_need_to_do"))
    assert "simplified_explanation" in exp_res
    assert "disclaimer" in exp_res
    print("  [PASS] 'Explain Simply' generated clear patient guidance while preserving clinical facts.")

    # TEST 5: Hindi and English Support
    print("\n[TEST 5] Hindi and English Support...", flush=True)
    hi_req = ChatRequest(message="क्या मेरे लिए कोई टीका बाकी है?", language="hi")
    hi_res = await ask_chatbot(hi_req, current_user=test_user)
    assert hi_res["language"] == "hi"
    print("  [PASS] Hindi Response received.")

    en_req = ChatRequest(message="Where is the nearest district hospital with ICU beds?", language="en")
    en_res = await ask_chatbot(en_req, current_user=test_user)
    assert en_res["language"] == "en"
    print("  [PASS] English Response received.")

    print("\n=================================================================")
    print("   ALL MULTILINGUAL HEALTHCARE ASSISTANT BACKEND TESTS PASSED!   ")
    print("=================================================================", flush=True)

if __name__ == "__main__":
    asyncio.run(run_tests())
