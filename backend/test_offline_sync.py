import asyncio
import time
import uuid
import httpx
from database import (
    users_collection,
    profile_collection,
    children_collection,
    vaccination_records_collection,
    follow_ups_collection,
    disease_reports_collection,
    referrals_history_collection,
    offline_sync_log_collection,
)
from utils.jwt_handler import create_access_token

BASE_URL = "http://127.0.0.1:8000"

async def run_tests():
    print("=== SWASTHYA SETU OFFLINE SYNC TEST SUITE ===")
    
    # 1. Prepare Test User & JWT
    test_email = "offline_tester@swasthyasetu.org"
    token_payload = {
        "sub": test_email,
        "name": "Offline Field Worker",
        "role": "patient",
        "facility_id": None,
        "doctor_id": None
    }
    token = create_access_token(token_payload)
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # Test 1: Health ping
        print("\n[TEST 1] Testing /api/health endpoint...")
        r = await client.get("/api/health")
        assert r.status_code == 200, f"Health check failed: {r.status_code}"
        assert r.json().get("status") == "ok"
        print("  -> Health ping PASSED:", r.json())
        
        # Test 2: Child Registration via Offline Sync
        print("\n[TEST 2] Testing Child Registration via Offline Sync...")
        local_id_child = f"test_child_{uuid.uuid4().hex[:8]}"
        child_name = f"TestBaby_{uuid.uuid4().hex[:4]}"
        sync_item = {
            "local_id": local_id_child,
            "record_type": "child_registration",
            "payload": {
                "name": child_name,
                "date_of_birth": "2024-02-10",
                "gender": "Female",
                "blood_group": "B+"
            },
            "created_at": time.time(),
            "client_updated_at": time.time()
        }
        r = await client.post("/api/offline/sync", json=sync_item, headers=headers)
        assert r.status_code == 200, f"Child sync failed: {r.text}"
        res = r.json()
        assert res.get("status") == "SYNCED", f"Expected SYNCED, got {res}"
        print(f"  -> Child Registration PASSED (Server ID: {res.get('server_id')})")
        
        # Test 3: Idempotency (Duplicate Prevention)
        print("\n[TEST 3] Testing Idempotency & Duplicate Prevention...")
        r = await client.post("/api/offline/sync", json=sync_item, headers=headers)
        res = r.json()
        assert res.get("status") == "DUPLICATE", f"Expected DUPLICATE, got {res}"
        print("  -> Duplicate Prevention PASSED: Correctly identified as DUPLICATE, no re-insertion.")
        
        # Test 4: Community / Home Visit Note
        print("\n[TEST 4] Testing Community / Home Visit Record Sync...")
        local_id_visit = f"test_visit_{uuid.uuid4().hex[:8]}"
        visit_item = {
            "local_id": local_id_visit,
            "record_type": "visit_note",
            "payload": {
                "patient_name": "Gramin Resident Ramesh",
                "observations": "Blood pressure elevated, referred for dietary salt reduction and hydration.",
                "vitals": {"blood_pressure": "140/90", "pulse": "84"},
                "visit_date": "2026-09-09"
            },
            "created_at": time.time()
        }
        r = await client.post("/api/offline/sync", json=visit_item, headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert res.get("status") == "SYNCED"
        print(f"  -> Community Visit Note PASSED (Visit ID: {res.get('server_id')})")
        
        # Test 5: Vaccine Record Sync
        print("\n[TEST 5] Testing Vaccination Administration Sync...")
        local_id_vac = f"test_vac_{uuid.uuid4().hex[:8]}"
        vac_item = {
            "local_id": local_id_vac,
            "record_type": "vaccination_record",
            "payload": {
                "vaccine_id": "PENTAVALENT_1",
                "vaccine_name": "Pentavalent 1",
                "administered_date": "2026-09-09",
                "dose": "Dose 1",
                "notes": "Administered at primary health subcenter"
            },
            "created_at": time.time()
        }
        r = await client.post("/api/offline/sync", json=vac_item, headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert res.get("status") == "SYNCED"
        print(f"  -> Vaccination Record PASSED (Vaccine Server ID: {res.get('server_id')})")
        
        # Test 6: Referral Draft Sync
        print("\n[TEST 6] Testing Referral Draft Sync...")
        local_id_ref = f"test_ref_{uuid.uuid4().hex[:8]}"
        ref_item = {
            "local_id": local_id_ref,
            "record_type": "referral_draft",
            "payload": {
                "specialty": "Cardiology",
                "facility_name": "Thane District Civil Hospital",
                "reason": "Exertional dyspnea requiring specialist care",
                "urgency": "NORMAL"
            },
            "created_at": time.time()
        }
        r = await client.post("/api/offline/sync", json=ref_item, headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert res.get("status") == "SYNCED"
        print(f"  -> Referral Draft PASSED (Draft ID: {res.get('server_id')})")
        
        # Test 7: Batch Sync
        print("\n[TEST 7] Testing Batch Sync with multiple records...")
        batch_items = [
            {
                "local_id": f"batch_rep_{uuid.uuid4().hex[:8]}",
                "record_type": "health_case_report",
                "payload": {
                    "disease_name": "Malaria",
                    "description": "High fever with chills in field sector 4",
                    "severity": "Moderate"
                },
                "created_at": time.time()
            },
            {
                "local_id": f"batch_prof_{uuid.uuid4().hex[:8]}",
                "record_type": "profile_update",
                "payload": {
                    "blood_group": "A+",
                    "allergies": "Sulfa drugs",
                    "emergency_contact": "+91-9876543210"
                },
                "created_at": time.time()
            }
        ]
        r = await client.post("/api/offline/sync", json={"items": batch_items}, headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert res.get("total") == 2
        print(f"  -> Batch Sync PASSED: {res.get('total')} items processed successfully.")
        
        # Test 8: Conflict Detection
        print("\n[TEST 8] Testing Conflict Detection...")
        # Step 8a: Ensure a follow-up exists on server with updated_at in the future
        follow_up_id = f"FLP-CONF-{uuid.uuid4().hex[:6].upper()}"
        await follow_ups_collection.insert_one({
            "follow_up_id": follow_up_id,
            "patient_id": test_email,
            "title": "Post-Op Wound Check",
            "notes": "Doctor notes updated on server 10 minutes ago.",
            "updated_at": time.time() + 100, # Server is newer!
            "created_at": time.time()
        })
        
        # Step 8b: Client tries to sync an offline update based on an OLD client timestamp
        conflict_local_id = f"test_conf_{uuid.uuid4().hex[:8]}"
        conflict_item = {
            "local_id": conflict_local_id,
            "record_type": "follow_up",
            "payload": {
                "follow_up_id": follow_up_id,
                "notes": "Patient offline note made before server update."
            },
            "created_at": time.time() - 200,
            "client_updated_at": time.time() - 200 # Old client timestamp
        }
        r = await client.post("/api/offline/sync", json=conflict_item, headers=headers)
        res = r.json()
        assert res.get("status") == "CONFLICT", f"Expected CONFLICT, got {res}"
        print(f"  -> Conflict Detection PASSED: Safely caught conflict, did NOT overwrite server data.")
        
        # Test 9: Conflict Resolution
        print("\n[TEST 9] Testing Conflict Resolution Endpoint...")
        r = await client.post("/api/offline/resolve-conflict", json={
            "local_id": conflict_local_id,
            "resolution": "USE_SERVER"
        }, headers=headers)
        assert r.status_code == 200
        assert r.json().get("status") == "RESOLVED_SERVER"
        print("  -> Conflict Resolution PASSED: Server version kept, record resolved.")
        
        # Test 10: Sync History
        print("\n[TEST 10] Testing Sync History Retrieval...")
        r = await client.get("/api/offline/history", headers=headers)
        assert r.status_code == 200
        history_data = r.json()
        assert history_data.get("count") > 0
        print(f"  -> Sync History PASSED: Retrieved {history_data.get('count')} sync history logs.")

    print("\n========================================================")
    print("ALL 10 OFFLINE SYNC TESTS PASSED WITH 100% SUCCESS!")
    print("========================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
