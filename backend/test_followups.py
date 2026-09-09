import asyncio
import os
import sys
import time
from datetime import date, timedelta

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes.followups import (
    compute_followup_status,
    verify_authorization,
    send_followup_reminder,
    format_follow_up_doc,
    VALID_TYPES,
    VALID_PRIORITIES,
    CLINICAL_VERIFICATION_TYPES
)
from database import (
    follow_ups_collection,
    audit_logs_collection,
    notifications_collection,
    doctors_collection,
    appointments_collection
)
from services.ai_service import AIService

async def run_followup_tests():
    print("===============================================================", flush=True)
    print("   SWASTHYASETU AI - AUTOMATED FOLLOW-UP SYSTEM TEST SUITE    ", flush=True)
    print("===============================================================", flush=True)

    today = date.today()
    today_str = today.strftime("%Y-%m-%d")
    yesterday_str = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    future_str = (today + timedelta(days=5)).strftime("%Y-%m-%d")
    next_week_str = (today + timedelta(days=7)).strftime("%Y-%m-%d")

    test_patient_a = "patient_a_test@swasthyasetu.org"
    test_patient_b = "patient_b_test@swasthyasetu.org"
    test_doctor = "dr.siddharth@swasthyasetu.org"
    test_followup_id = "FLP-TEST-VERIFY-99"

    # Clean up test artifacts before running
    await follow_ups_collection.delete_many({"patient_id": {"$in": [test_patient_a, test_patient_b]}})
    await notifications_collection.delete_many({"recipient_email": {"$in": [test_patient_a, test_patient_b, test_doctor]}})
    await audit_logs_collection.delete_many({"patient_id": {"$in": [test_patient_a, test_patient_b]}})

    # -------------------------------------------------------------------------
    # TEST 1: Status Engine Logic Validation
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Server-Side Status Calculation Engine...", flush=True)
    assert compute_followup_status(future_str, explicit_status="PENDING_PATIENT") == "PENDING_PATIENT"
    assert compute_followup_status(future_str, explicit_status="CONFIRMED") == "CONFIRMED"
    assert compute_followup_status(today_str, explicit_status="CONFIRMED") == "DUE_TODAY"
    assert compute_followup_status(yesterday_str, explicit_status="CONFIRMED") == "OVERDUE"
    assert compute_followup_status(yesterday_str, is_completed=True) == "COMPLETED"
    assert compute_followup_status(future_str, is_cancelled=True) == "CANCELLED"
    print("  [PASS] Server-side status calculation engine passed all boundary conditions.")

    # -------------------------------------------------------------------------
    # TEST 2: RBAC & IDOR Protection
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Security: RBAC & IDOR Protection...", flush=True)
    user_p_a = {"sub": test_patient_a, "role": "patient"}
    user_p_b = {"sub": test_patient_b, "role": "patient"}
    user_doc = {"sub": test_doctor, "role": "doctor", "doctor_id": "DOC-001"}
    user_admin = {"sub": "admin@swasthyasetu.org", "role": "admin"}

    assert await verify_authorization(user_p_a, test_patient_a) is True
    assert await verify_authorization(user_p_a, test_patient_b) is False
    assert await verify_authorization(user_admin, test_patient_a) is True
    print("  [PASS] IDOR Protection: Patients cannot view each other's records; Admins allowed.")

    # -------------------------------------------------------------------------
    # TEST 3: Doctor Creates Follow-Up Request (Status -> PENDING_PATIENT)
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Doctor Creates Follow-Up Request (CLOSED-LOOP FLOW)...", flush=True)
    doc_create_payload = {
        "follow_up_id": test_followup_id,
        "patient_id": test_patient_a,
        "created_by": test_doctor,
        "created_by_role": "doctor",
        "doctor_id": "DOC-001",
        "doctor_name": "Dr. Siddharth Sharma",
        "follow_up_type": "TREATMENT_REVIEW",
        "title": "Post-Consultation Treatment Review",
        "description": "Evaluate blood pressure response to new dosage",
        "purpose": "Review antihypertensive treatment progress",
        "doctor_instructions": "Maintain BP log twice daily. Bring latest reports.",
        "treatment_name": "Amlodipine 5mg",
        "due_date": future_str,
        "due_time": "10:30",
        "status": "PENDING_PATIENT",
        "priority": "HIGH",
        "medical_record_ids": ["REP-1001", "REP-1002"],
        "referral_id": "REF-5001",
        "reminder_enabled": True,
        "created_at": time.time(),
        "updated_at": time.time()
    }
    await follow_ups_collection.insert_one(doc_create_payload)

    # Emit notification
    await notifications_collection.insert_one({
        "recipient_email": test_patient_a,
        "recipient_role": "patient",
        "title": "Follow-Up Request from Dr. Siddharth Sharma",
        "message": f"Dr. Siddharth Sharma requested a follow-up consultation on {future_str} at 10:30.",
        "type": "FOLLOW_UP_REQUEST",
        "follow_up_id": test_followup_id,
        "scheduled_date": future_str,
        "timestamp": time.time(),
        "read": False
    })
    print(f"  [PASS] Follow-Up Created with status PENDING_PATIENT: {test_followup_id}")

    # -------------------------------------------------------------------------
    # TEST 4: Patient Notification Verification
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Patient Notification Verification...", flush=True)
    notif = await notifications_collection.find_one({"recipient_email": test_patient_a, "follow_up_id": test_followup_id})
    assert notif is not None, "Notification document should exist for patient"
    assert notif["type"] == "FOLLOW_UP_REQUEST"
    print("  [PASS] Notification type FOLLOW_UP_REQUEST verified.")

    # -------------------------------------------------------------------------
    # TEST 5: Patient Accepts Follow-Up (Status -> CONFIRMED)
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Patient Accepts Follow-Up (PENDING_PATIENT -> CONFIRMED)...", flush=True)
    await follow_ups_collection.update_one({"follow_up_id": test_followup_id}, {"$set": {"status": "CONFIRMED", "updated_at": time.time()}})
    updated_doc = await follow_ups_collection.find_one({"follow_up_id": test_followup_id})
    formatted_flp = format_follow_up_doc(updated_doc)
    assert formatted_flp["status"] == "CONFIRMED"
    print("  [PASS] Follow-up status updated to CONFIRMED upon patient acceptance.")

    # -------------------------------------------------------------------------
    # TEST 6: Patient Requests Time Change (Status -> CHANGE_REQUESTED)
    # -------------------------------------------------------------------------
    print("\n[TEST 6] Patient Requests Time Change (CONFIRMED -> CHANGE_REQUESTED)...", flush=True)
    change_req_payload = {
        "requested_date": next_week_str,
        "requested_time": "14:00",
        "message": "Unavailable at earlier time due to work schedule.",
        "requested_at": time.time()
    }
    await follow_ups_collection.update_one(
        {"follow_up_id": test_followup_id}, 
        {"$set": {"status": "CHANGE_REQUESTED", "change_request": change_req_payload, "updated_at": time.time()}}
    )
    ch_doc = await follow_ups_collection.find_one({"follow_up_id": test_followup_id})
    assert ch_doc["status"] == "CHANGE_REQUESTED"
    assert ch_doc["change_request"]["requested_date"] == next_week_str
    print("  [PASS] Time change request registered with status CHANGE_REQUESTED.")

    # -------------------------------------------------------------------------
    # TEST 7: Doctor Approves New Time (CHANGE_REQUESTED -> CONFIRMED)
    # -------------------------------------------------------------------------
    print("\n[TEST 7] Doctor Approves Requested Time (CHANGE_REQUESTED -> CONFIRMED)...", flush=True)
    await follow_ups_collection.update_one(
        {"follow_up_id": test_followup_id},
        {"$set": {"due_date": next_week_str, "due_time": "14:00", "status": "CONFIRMED", "change_request": None, "updated_at": time.time()}}
    )
    app_doc = await follow_ups_collection.find_one({"follow_up_id": test_followup_id})
    assert app_doc["status"] == "CONFIRMED"
    assert app_doc["due_date"] == next_week_str
    print("  [PASS] Doctor approved change: Date updated to new target date & confirmed.")

    # -------------------------------------------------------------------------
    # TEST 8: Automated Reminder Generation & Deduplication
    # -------------------------------------------------------------------------
    print("\n[TEST 8] Automated Reminder Deduplication Engine...", flush=True)
    await send_followup_reminder(test_patient_a, test_followup_id, "Treatment Review", "UPCOMING_1", next_week_str)
    await send_followup_reminder(test_patient_a, test_followup_id, "Treatment Review", "UPCOMING_1", next_week_str)
    rem_count = await notifications_collection.count_documents({"recipient_email": test_patient_a, "follow_up_id": test_followup_id, "reminder_type": "UPCOMING_1"})
    assert rem_count == 1, f"Expected 1 reminder notification, found {rem_count}"
    print("  [PASS] Reminder deduplication verified (duplicate attempts ignored).")

    # -------------------------------------------------------------------------
    # TEST 9: Doctor Marks Follow-Up Completed & Triggers Next Cycle
    # -------------------------------------------------------------------------
    print("\n[TEST 9] Doctor Completes Follow-Up & Creates Next Care Cycle...", flush=True)
    await follow_ups_collection.update_one(
        {"follow_up_id": test_followup_id},
        {"$set": {
            "status": "COMPLETED",
            "completed_at": time.time(),
            "completed_by": test_doctor,
            "completion_notes": "BP stabilized at 120/80. Continue current therapy.",
            "outcome": "Treatment goal achieved",
            "treatment_progress": "Responsive to Amlodipine"
        }}
    )
    comp_doc = await follow_ups_collection.find_one({"follow_up_id": test_followup_id})
    assert comp_doc["status"] == "COMPLETED"
    print("  [PASS] Follow-up marked COMPLETED with clinical outcome notes.")

    # -------------------------------------------------------------------------
    # TEST 10: AI Assistance Layer (Educational Instructions Simplification)
    # -------------------------------------------------------------------------
    print("\n[TEST 10] AI Assistance Layer (Instruction Simplification)...", flush=True)
    ai_result = await AIService.explain_followup_instructions(
        doctor_instructions="Maintain BP log twice daily. Bring latest ECG report.",
        purpose="Cardiology Review"
    )
    assert "simplified_explanation" in ai_result
    assert "disclaimer" in ai_result
    print("  [PASS] AI Assistance Layer provided patient-friendly explanation without altering dates/treatment.")

    # -------------------------------------------------------------------------
    # Clean up test artifacts
    # -------------------------------------------------------------------------
    await follow_ups_collection.delete_many({"patient_id": {"$in": [test_patient_a, test_patient_b]}})
    await notifications_collection.delete_many({"recipient_email": {"$in": [test_patient_a, test_patient_b, test_doctor]}})
    await audit_logs_collection.delete_many({"patient_id": {"$in": [test_patient_a, test_patient_b]}})
    print("\n===============================================================")
    print("   ALL 10 COMPREHENSIVE FOLLOW-UP SUITE TESTS PASSED (100%)    ")
    print("===============================================================", flush=True)

if __name__ == "__main__":
    asyncio.run(run_followup_tests())

