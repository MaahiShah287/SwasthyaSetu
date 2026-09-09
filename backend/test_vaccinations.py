import asyncio
import os
import sys
import time
from datetime import date, timedelta

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from routes.vaccinations import (
    compute_backend_status,
    parse_date,
    verify_authorization,
    STANDARD_VACCINE_SCHEDULES
)
from database import (
    vaccinations_collection,
    audit_logs_collection,
    notifications_collection,
    users_collection
)

async def run_vaccination_tests():
    print("===============================================================", flush=True)
    print("   SWASTHYASETU AI - VACCINATION MODULE TEST SUITE", flush=True)
    print("===============================================================", flush=True)

    today = date.today()
    today_str = today.strftime("%Y-%m-%d")

    # -------------------------------------------------------------------------
    # TEST 1: Status Engine Logic
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Backend Status Calculation Engine...", flush=True)

    # Completed dose without next due date -> COMPLETED
    s1 = compute_backend_status(today_str, None, is_completed=True)
    assert s1 == "COMPLETED", f"Expected COMPLETED, got {s1}"
    print("  [PASS] Completed dose without next due date -> COMPLETED")

    # Completed dose with future next due date (> 7 days) -> COMPLETED
    future_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")
    s2 = compute_backend_status(today_str, future_date, is_completed=True)
    assert s2 == "COMPLETED", f"Expected COMPLETED, got {s2}"
    print("  [PASS] Completed dose with distant future next due date -> COMPLETED")

    # Completed dose with next due date within 7 days -> DUE_SOON
    due_soon_date = (today + timedelta(days=3)).strftime("%Y-%m-%d")
    s3 = compute_backend_status(today_str, due_soon_date, is_completed=True)
    assert s3 == "DUE_SOON", f"Expected DUE_SOON, got {s3}"
    print("  [PASS] Completed dose with next due date in 3 days -> DUE_SOON")

    # Completed dose with past next due date (5 days overdue) -> OVERDUE
    overdue_date = (today - timedelta(days=5)).strftime("%Y-%m-%d")
    s4 = compute_backend_status(today_str, overdue_date, is_completed=True)
    assert s4 == "OVERDUE", f"Expected OVERDUE, got {s4}"
    print("  [PASS] Next due date 5 days in past -> OVERDUE")

    # Uncompleted dose with past due date (> 30 days) -> MISSED
    missed_date = (today - timedelta(days=40)).strftime("%Y-%m-%d")
    s5 = compute_backend_status(today_str, missed_date, is_completed=False)
    assert s5 == "MISSED", f"Expected MISSED, got {s5}"
    print("  [PASS] Uncompleted dose > 30 days past due -> MISSED")

    # -------------------------------------------------------------------------
    # TEST 2: Immunization Schedule & Date Parser
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Verified Reference Schedule & Date Parsing...", flush=True)

    parsed = parse_date("2026-09-08T10:00:00Z")
    assert parsed == date(2026, 9, 8), f"Failed date parse: {parsed}"
    print("  [PASS] ISO Date String parsed correctly to Date object.")

    assert len(STANDARD_VACCINE_SCHEDULES) >= 5, "Missing reference schedules"
    print(f"  [PASS] {len(STANDARD_VACCINE_SCHEDULES)} reference schedules loaded.")

    # -------------------------------------------------------------------------
    # TEST 3: Security & Authorization (RBAC / IDOR Protection)
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Security: RBAC & IDOR Protection...", flush=True)

    patient_user_a = {"sub": "test_patient_a@swasthyasetu.ai", "role": "patient"}
    patient_user_b = {"sub": "test_patient_b@swasthyasetu.ai", "role": "patient"}
    admin_user = {"sub": "admin@swasthyasetu.ai", "role": "admin"}

    # Patient A accessing own record -> True
    auth_own = await verify_authorization(patient_user_a, "test_patient_a@swasthyasetu.ai")
    assert auth_own is True, "Patient should be authorized for own record"
    print("  [PASS] Patient A authorized to access own vaccination record.")

    # Patient A accessing Patient B record -> False (IDOR blocked)
    auth_other = await verify_authorization(patient_user_a, "test_patient_b@swasthyasetu.ai")
    assert auth_other is False, "Patient A should NOT be authorized for Patient B record"
    print("  [PASS] IDOR Protection: Patient A blocked from accessing Patient B record.")

    # Admin accessing any record -> True
    auth_admin = await verify_authorization(admin_user, "test_patient_a@swasthyasetu.ai")
    assert auth_admin is True, "Admin should be authorized"
    print("  [PASS] Admin authorized to access patient records.")

    # -------------------------------------------------------------------------
    # TEST 4: Isolated Test Fixture Data CRUD & Audit Trail
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Database CRUD & Audit Trail Verification...", flush=True)

    test_patient_id = "test_fixture_patient_99@swasthyasetu.ai"

    # Insert isolated test record
    test_doc = {
        "patient_id": test_patient_id,
        "vaccine_name": "TEST FIXTURE - MMR Booster",
        "vaccine_code": "CVX-03",
        "dose_number": 2,
        "dose_label": "Dose 2",
        "vaccination_date": today_str,
        "next_due_date": (today + timedelta(days=365)).strftime("%Y-%m-%d"),
        "is_completed": True,
        "status": "COMPLETED",
        "record_source": "PATIENT_ENTERED",
        "verified": False,
        "created_at": time.time(),
        "updated_at": time.time()
    }

    res = await vaccinations_collection.insert_one(test_doc)
    inserted_id = res.inserted_id
    assert inserted_id is not None, "Failed to insert test record"
    print(f"  [PASS] Test record inserted successfully: {inserted_id}")

    # Fetch test record
    fetched = await vaccinations_collection.find_one({"_id": inserted_id})
    assert fetched["vaccine_name"] == "TEST FIXTURE - MMR Booster", "Mismatch in inserted test record"
    print("  [PASS] Test record fetched and validated.")

    # Cleanup test record
    await vaccinations_collection.delete_one({"_id": inserted_id})
    print("  [PASS] Isolated test record cleaned up successfully.")

    # -------------------------------------------------------------------------
    # TEST 5: Child Vaccination Tracking System & NIS Schedule Engine
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Child Vaccination Tracking & NIS Schedule Engine...", flush=True)

    from routes.vaccinations import (
        calculate_child_age,
        create_child,
        get_child_schedule,
        get_next_child_vaccination,
        get_child_immunization_gaps,
        record_child_vaccination,
        ChildCreateRequest,
        ChildVaccinationRecordCreate
    )

    # 1. Newborn age calculation & At Birth schedule check
    newborn_dob = today.strftime("%Y-%m-%d")
    nb_age = calculate_child_age(newborn_dob)
    assert nb_age["is_newborn"] is True, "Expected is_newborn True for today's DOB"
    print("  [PASS] Newborn DOB age calculation evaluated as Newborn.")

    # 2. Create Newborn Child fixture
    parent_user = {"sub": "test_parent_42@swasthyasetu.ai", "role": "patient"}
    nb_req = ChildCreateRequest(
        name="Aarav Test",
        date_of_birth=newborn_dob,
        gender="boy",
        district="Mumbai",
        state="Maharashtra",
        is_je_endemic=True
    )
    created_nb = await create_child(nb_req, parent_user)
    nb_id = created_nb["id"]
    assert created_nb["name"] == "Aarav Test", "Child creation failed"
    print(f"  [PASS] Created child profile successfully: {nb_id}")

    # 3. Retrieve schedule for newborn
    sched = await get_child_schedule(nb_id, parent_user)
    assert sched["metrics"]["total"] > 10, "Schedule missing NIS vaccines"
    at_birth_ms = next(m for m in sched["timeline"] if m["milestone_id"] == "AT_BIRTH")
    at_birth_statuses = [v["status"] for v in at_birth_ms["vaccines"]]
    assert all(s == "DUE" for s in at_birth_statuses), f"Expected DUE for birth vaccines, got {at_birth_statuses}"
    print("  [PASS] At Birth vaccines for newborn marked DUE.")

    # 4. Next Vaccination calculation for newborn
    next_v = await get_next_child_vaccination(nb_id, parent_user)
    assert next_v["has_next"] is True, "Expected next vaccination"
    assert next_v["next_vaccination"]["status"] == "DUE"
    print(f"  [PASS] Next vaccination correctly computed: {next_v['next_vaccination']['vaccine_name']}")

    # 5. Record administration of BCG
    rec_req = ChildVaccinationRecordCreate(
        vaccine_id="BCG",
        vaccine_name="BCG",
        administered_date=newborn_dob,
        facility_name="Urban Immunization Centre Dadar"
    )
    rec_res = await record_child_vaccination(nb_id, rec_req, parent_user)
    assert rec_res["status"] == "COMPLETED"
    print("  [PASS] BCG vaccination recorded with actual date.")

    # 6. Verify progress updated after record
    sched_updated = await get_child_schedule(nb_id, parent_user)
    assert sched_updated["metrics"]["completed"] == 1
    assert sched_updated["metrics"]["progress_percentage"] > 0
    print("  [PASS] Schedule metrics & progress percentage updated cleanly.")

    # 7. Cleanup child test fixtures
    from database import children_collection, vaccination_records_collection
    await children_collection.delete_one({"_id": created_nb["_id"] if isinstance(created_nb["_id"], str) else created_nb["_id"]})
    await vaccination_records_collection.delete_many({"child_id": nb_id})
    print("  [PASS] Child test fixtures cleaned up.")

    print("\n===============================================================", flush=True)
    print("   ALL VACCINATION BACKEND & SECURITY TESTS PASSED!", flush=True)
    print("===============================================================", flush=True)

def test_vaccination_suite():
    """Pytest entrypoint wrapper."""
    asyncio.run(run_vaccination_tests())

if __name__ == "__main__":
    asyncio.run(run_vaccination_tests())
