import asyncio
import os
import sys
import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routes.telemedicine import create_telemedicine_room, get_facility_doctors, CreateTelemedicineSessionRequest
from routes.emergency import get_emergency_ambulances, get_emergency_facilities

# Dummy authenticated user mock
MOCK_USER = {"sub": "patient_test@swasthyasetu.gov.in"}


async def run_tests():
    print("=== STARTING TELEMEDICINE & EMERGENCY TEST SUITE ===\n")

    # TEST 1: Retrieve Database Specialists for Facility
    print("[TEST 1] Telemedicine: Fetching database specialists for FAC-001...")
    doctors_res = await get_facility_doctors("FAC-001", current_user=MOCK_USER)
    assert doctors_res["has_telemedicine"] is True
    assert "Cardiologist" in doctors_res["specialists"]
    print(f"  [PASS] Facility specialists retrieved: {doctors_res['specialists'][:3]}")

    # TEST 2: Telemedicine Google Meet Room Creation / Setup Notice
    print("\n[TEST 2] Telemedicine: Creating consultation session...")
    session_req = CreateTelemedicineSessionRequest(
        facility_id="FAC-001",
        specialist_name="Cardiologist",
        consultation_type="Specialist Consultation",
        patient_notes="Patient experiencing mild chest tightness."
    )
    room_res = await create_telemedicine_room(session_req, current_user=MOCK_USER)
    assert "session_id" in room_res
    assert room_res["facility_name"] == "Sanjeevani District Civil Hospital"
    print(f"  [PASS] Session Created ID: {room_res['session_id']}")
    print(f"         Google API Status: Configured={room_res['is_google_api_configured']}")
    print(f"         Status Note: {room_res['message']}")

    # TEST 3: Database Emergency Ambulance Fleet Lookup
    print("\n[TEST 3] Emergency Response: Querying database ambulance fleet...")
    amb_res = await get_emergency_ambulances(user_lat=19.0760, user_lon=72.8777, current_user=MOCK_USER)
    ambulances = amb_res["ambulances"]
    assert len(ambulances) >= 4
    assert ambulances[0]["ambulance_id"].startswith("AMB-108")
    assert "distance_km" in ambulances[0]
    print(f"  [PASS] Database Fleet retrieved: {len(ambulances)} ambulances")
    print(f"         Nearest Unit: {ambulances[0]['ambulance_id']} ({ambulances[0].get('vehicle_type', 'Ambulance')}) - {ambulances[0]['distance_km']} km away")

    # TEST 4: Emergency Facilities Lookup (is_24x7_emergency: true)
    print("\n[TEST 4] Emergency Response: Querying 24/7 emergency hospitals...")
    fac_res = await get_emergency_facilities(user_lat=19.0760, user_lon=72.8777, current_user=MOCK_USER)
    facilities = fac_res["emergency_facilities"]
    assert len(facilities) > 0
    assert all(f["is_24x7_emergency"] for f in facilities)
    print(f"  [PASS] 24/7 Emergency Hospitals retrieved: {len(facilities)} facilities")
    print(f"         Top Hospital: {facilities[0]['name']} (ICU Beds: {facilities[0]['icu_beds_available']})")

    print("\n=== ALL TELEMEDICINE & EMERGENCY TESTS PASSED SUCCESSFULLY ===")


if __name__ == "__main__":
    asyncio.run(run_tests())
