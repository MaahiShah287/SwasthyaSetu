import asyncio
import time
import datetime
from database import consultations_collection, doctors_collection, healthcare_facilities_collection, db
from routes.telemedicine import create_consultation_request, create_google_meet_event, SEED_DOCTORS, CreateConsultationRequest

async def run_double_booking_test():
    print("=== TESTING SERVER-SIDE DOUBLE BOOKING PROTECTION ===")
    
    # Clean test records
    test_slot = "2026-09-10 10:00"
    test_doc_id = "DOC-001"
    test_fac_id = "FAC-001"

    await consultations_collection.delete_many({
        "doctor_id": test_doc_id,
        "scheduled_time": test_slot
    })

    user_1 = {"sub": "patient1@test.com", "role": "patient", "name": "Patient One"}
    user_2 = {"sub": "patient2@test.com", "role": "patient", "name": "Patient Two"}

    req_1 = CreateConsultationRequest(doctor_id=test_doc_id, facility_id=test_fac_id, scheduled_at=test_slot)
    req_2 = CreateConsultationRequest(doctor_id=test_doc_id, facility_id=test_fac_id, scheduled_at=test_slot)

    # 1. First booking should succeed
    res_1 = await create_consultation_request(req_1, current_user=user_1)
    assert res_1["consultation_id"] is not None
    print(f"  [PASS] Booking 1 Succeeded: ID={res_1['consultation_id']} for {test_slot}")

    # 2. Second booking for SAME doctor & SAME time slot must fail with HTTP 409
    try:
        await create_consultation_request(req_2, current_user=user_2)
        print("  [FAIL] Booking 2 succeeded unexpectedly (Double booking protection failed).")
        assert False
    except Exception as e:
        assert getattr(e, "status_code", None) == 409
        print(f"  [PASS] Booking 2 REJECTED with Conflict (HTTP 409): {e.detail}")

    # Clean up test records
    await consultations_collection.delete_many({
        "doctor_id": test_doc_id,
        "scheduled_time": test_slot
    })

    print("=== DOUBLE BOOKING PROTECTION TEST COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(run_double_booking_test())
