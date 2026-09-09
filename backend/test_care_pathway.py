import asyncio
import os
import sys
import time

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.facility_service import FacilityService, haversine_distance, format_data_freshness
from services.ai_service import AIService
from routes.triage import evaluate_red_flags, TriageRequest


async def run_care_pathway_tests():
    print("=== STARTING AI REFERRAL & CARE PATHWAY TEST SUITE ===", flush=True)

    # Test 1: Haversine distance calculation
    print("\n[TEST 1] Distance Engine: Testing Haversine distance math...", flush=True)
    # Distance between Mumbai (19.0760, 72.8777) and Badlapur (19.1650, 73.2380) is ~39 km
    dist = haversine_distance(19.0760, 72.8777, 19.1650, 73.2380)
    print(f"  [PASS] Calculated distance between Mumbai & Badlapur: {dist} km")
    assert 30.0 <= dist <= 45.0, f"Unexpected distance calculation: {dist} km"

    # Test 2: Data freshness utility
    print("\n[TEST 2] Data Freshness: Verifying stale data thresholding...", flush=True)
    recent_ts = time.time() - 1800  # 30 mins
    stale_ts = time.time() - 172800  # 48 hours

    text_recent, is_stale_recent = format_data_freshness(recent_ts)
    text_stale, is_stale_stale = format_data_freshness(stale_ts)

    print(f"  [PASS] Recent timestamp -> '{text_recent}' (Is stale: {is_stale_recent})")
    print(f"  [PASS] Stale timestamp -> '{text_stale}' (Is stale: {is_stale_stale})")
    assert not is_stale_recent, "30-min-old timestamp should not be marked stale"
    assert is_stale_stale, "48-hour-old timestamp MUST be marked stale"

    # Test 3: Facility Seeding & Capability Retrieval
    print("\n[TEST 3] Facility Directory: Verifying seed database capabilities...", flush=True)
    await FacilityService.ensure_seeded()
    facilities = await FacilityService.get_all_facilities()
    print(f"  [PASS] Facility database contains {len(facilities)} verified facilities")
    assert len(facilities) >= 5, "Failed to load facility seed dataset"

    # Test 4: Emergency Care Pathway Scenario
    print("\n[TEST 4] Emergency Scenario: Matching acute severe chest pain symptoms...", flush=True)
    req_emergency = TriageRequest(
        main_symptom="Severe crushing chest pain and shortness of breath",
        duration="30 mins",
        severity="Extreme",
        age_group="Adult"
    )
    red_flag = evaluate_red_flags(req_emergency)
    assert red_flag is not None and red_flag["urgency_level"] == "EMERGENCY"

    emergency_input = req_emergency.dict()
    service_eval_er = await AIService.determine_required_services(red_flag, emergency_input)
    print(f"  [PASS] AI Service Mapping for Emergency -> Primary Service: '{service_eval_er['primary_required_service']}'")

    pathway_er = await FacilityService.recommend_care_pathway(
        required_service=service_eval_er["primary_required_service"],
        urgency_level="EMERGENCY",
        user_lat=19.0760,
        user_lon=72.8777
    )
    best_er = pathway_er["best_match"]
    assert best_er is not None, "Emergency scenario should find a suitable facility"
    print(f"  [PASS] Best Match for Emergency: '{best_er['facility']['name']}' (Match Score: {best_er['total_score']}%, 24/7 ER: {best_er['facility']['is_24x7_emergency']})")
    assert best_er["facility"]["is_24x7_emergency"], "Emergency match MUST have 24/7 ER capability"

    # Test 5: Routine / Telemedicine Scenario
    print("\n[TEST 5] Routine Scenario: Matching mild cold symptoms...", flush=True)
    routine_triage = {
        "urgency_level": "ROUTINE",
        "summary": "Mild upper respiratory symptoms.",
        "recommended_service_type": "Primary Care Physician / Telehealth"
    }
    routine_input = {
        "main_symptom": "Mild sore throat and runny nose",
        "age_group": "Adult"
    }
    service_eval_routine = await AIService.determine_required_services(routine_triage, routine_input)
    pathway_routine = await FacilityService.recommend_care_pathway(
        required_service=service_eval_routine["primary_required_service"],
        urgency_level="ROUTINE",
        user_lat=19.0760,
        user_lon=72.8777
    )
    print(f"  [PASS] Routine Care Pathway generated. Best Match: '{pathway_routine['best_match']['facility']['name']}'")
    assert pathway_routine["has_suitable_match"], "Routine scenario should have suitable match"

    # Test 6: Stale Facility Data Penalty Test
    print("\n[TEST 6] Stale Data Test: Verifying penalty applied to facility with stale data...", flush=True)
    # FAC-005 has last_updated 48 hours ago
    fac_005 = next((f for f in facilities if f["facility_id"] == "FAC-005"), None)
    assert fac_005 is not None
    score_fac_005 = FacilityService.calculate_match_score(
        fac_005, "General consultation", "ROUTINE", 19.0760, 72.8777
    )
    print(f"  [PASS] FAC-005 Stale Status: {score_fac_005['is_stale']}, Stale Penalty: -{score_fac_005['score_breakdown']['stale_data_penalty']} pts")
    print(f"         Data Freshness text: '{score_fac_005['data_freshness_text']}'")
    assert score_fac_005["is_stale"], "FAC-005 should be recognized as stale"
    assert score_fac_005["score_breakdown"]["stale_data_penalty"] == 10, "Stale penalty should be 10 points"

    # Test 7: No Suitable Match Scenario
    print("\n[TEST 7] No Match Scenario: Querying rare unsupported service category...", flush=True)
    no_match_pathway = await FacilityService.recommend_care_pathway(
        required_service="Hyperbaric Radiation Therapy Unit",
        urgency_level="ROUTINE",
        user_lat=19.0760,
        user_lon=72.8777
    )
    print(f"  [PASS] No Match detected: Has suitable match = {no_match_pathway['has_suitable_match']}")
    print(f"         No match message: '{no_match_pathway['no_match_message']}'")
    print(f"         Fallback options count: {len(no_match_pathway['fallback_options'])}")
    assert not no_match_pathway["has_suitable_match"], "Unmatched service should return has_suitable_match=False"
    assert len(no_match_pathway["fallback_options"]) > 0, "No match scenario MUST provide nearest fallback options"

    print("\n=== ALL AI REFERRAL & CARE PATHWAY TESTS PASSED SUCCESSFULLY ===")


if __name__ == "__main__":
    asyncio.run(run_care_pathway_tests())
