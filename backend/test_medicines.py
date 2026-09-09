import asyncio
import sys
import os
import time

# Ensure UTF-8 output on Windows if possible
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import (
    db,
    medicine_inventory_collection,
    healthcare_facilities_collection,
    notifications_collection,
    users_collection,
    init_indexes
)
from routes.medicines import (
    ensure_medicine_inventory_seeded,
    calculate_stock_status,
    dispatch_stock_alert_notification
)
from services.facility_service import haversine_distance, DEFAULT_LAT, DEFAULT_LON

async def run_tests():
    print("==================================================")
    print("  SwasthyaSetu AI: Medicine Availability & Stock")
    print("              Verification Suite")
    print("==================================================")

    # 1. Initialize indexes and seed data
    print("\n[TEST 1] Initializing MongoDB Indexes & Seed Inventory...")
    await init_indexes()
    await ensure_medicine_inventory_seeded()

    count = await medicine_inventory_collection.count_documents({})
    print(f"[OK] Total medicine inventory items seeded: {count}")
    assert count > 0, "Seed inventory count must be greater than 0."

    # 2. Test Stock Status Calculation Formula
    print("\n[TEST 2] Testing Deterministic Stock Status Calculation...")
    status_available = calculate_stock_status(quantity=150, minimum_stock=50)
    assert status_available == "AVAILABLE", f"Expected AVAILABLE, got {status_available}"
    print(f"[OK] quantity=150, min=50 -> {status_available}")

    status_low = calculate_stock_status(quantity=50, minimum_stock=50)
    assert status_low == "LOW_STOCK", f"Expected LOW_STOCK, got {status_low}"
    print(f"[OK] quantity=50, min=50 -> {status_low}")

    status_low_2 = calculate_stock_status(quantity=12, minimum_stock=50)
    assert status_low_2 == "LOW_STOCK", f"Expected LOW_STOCK, got {status_low_2}"
    print(f"[OK] quantity=12, min=50 -> {status_low_2}")

    status_out = calculate_stock_status(quantity=0, minimum_stock=50)
    assert status_out == "OUT_OF_STOCK", f"Expected OUT_OF_STOCK, got {status_out}"
    print(f"[OK] quantity=0, min=50 -> {status_out}")

    # 3. Test Paracetamol 500mg Multi-Facility Availability & Distance Sorting
    print("\n[TEST 3] Testing Paracetamol 500mg Patient Availability Query...")
    cursor = medicine_inventory_collection.find({
        "medicine_name": {"$regex": "paracetamol", "$options": "i"}
    })
    items = []
    async for doc in cursor:
        items.append(doc)

    print(f"[OK] Found {len(items)} facilities stocking Paracetamol.")
    assert len(items) >= 3, "Expected at least 3 facilities stocking Paracetamol."

    # Verify presence of all three status types (Available, Low Stock, Out of Stock)
    statuses = {item["status"] for item in items}
    print(f"[OK] Distinct statuses found: {statuses}")
    assert "AVAILABLE" in statuses, "Expected AVAILABLE status in results."
    assert "LOW_STOCK" in statuses, "Expected LOW_STOCK status in results."
    assert "OUT_OF_STOCK" in statuses, "Expected OUT_OF_STOCK status in results."

    # Distance calculation test
    user_lat = 19.0760
    user_lon = 72.8777
    for item in items:
        fac = await healthcare_facilities_collection.find_one({"facility_id": item["facility_id"]})
        if fac:
            dist = haversine_distance(user_lat, user_lon, fac["latitude"], fac["longitude"])
            status_icon = "(AVAILABLE)" if item["status"] == "AVAILABLE" else "(LOW_STOCK)" if item["status"] == "LOW_STOCK" else "(OUT_OF_STOCK)"
            print(f"   {status_icon} {fac['name']} -- {item['status']} ({item['quantity']} units) -- {dist:.1f} km")

    # 4. Test Stock Alert Notification Generation
    print("\n[TEST 4] Testing Automated Stock Alert Notification Dispatch...")
    test_facility = {
        "facility_id": "TEST-FAC-001",
        "name": "Test Primary Health Centre",
        "admin_email": "test_admin@swasthyasetu.org"
    }

    # Dispatch Low Stock Alert
    await dispatch_stock_alert_notification(
        facility=test_facility,
        medicine_name="Amoxicillin",
        strength="500mg",
        quantity=8,
        minimum_stock=30,
        status="LOW_STOCK"
    )

    notif_low = await notifications_collection.find_one({
        "facility_id": "TEST-FAC-001",
        "notification_type": "LOW_STOCK"
    })
    assert notif_low is not None, "Low stock notification should be created."
    print(f"[OK] Low Stock notification created: '{notif_low['title']}'")

    # Dispatch Out of Stock Alert
    await dispatch_stock_alert_notification(
        facility=test_facility,
        medicine_name="Amoxicillin",
        strength="500mg",
        quantity=0,
        minimum_stock=30,
        status="OUT_OF_STOCK"
    )

    notif_out = await notifications_collection.find_one({
        "facility_id": "TEST-FAC-001",
        "notification_type": "OUT_OF_STOCK"
    })
    assert notif_out is not None, "Out of stock notification should be created."
    print(f"[OK] Out of Stock notification created: '{notif_out['title']}'")

    # Cleanup test notifications
    await notifications_collection.delete_many({"facility_id": "TEST-FAC-001"})
    print("[OK] Test notifications cleaned up.")

    # 5. Test Facility Inventory Item CRUD
    print("\n[TEST 5] Testing Medicine Inventory Item Insertion & Quantity Update...")
    test_inv_id = f"MED-TEST-{int(time.time())}"
    test_doc = {
        "inventory_id": test_inv_id,
        "facility_id": "FAC-001",
        "medicine_name": "Test-Ibuprofen",
        "generic_name": "Ibuprofen",
        "strength": "400mg",
        "form": "Tablet",
        "category": "Analgesic",
        "quantity": 100,
        "minimum_stock": 25,
        "status": "AVAILABLE",
        "batch_number": "IBU-TEST-01",
        "expiry_date": "2027-12-31",
        "unit": "Tablets",
        "price_inr": "Rs 0 (Govt Free)",
        "last_updated": time.time(),
        "updated_by": "tester@swasthyasetu.org"
    }
    await medicine_inventory_collection.insert_one(test_doc)

    # Verify inserted
    saved = await medicine_inventory_collection.find_one({"inventory_id": test_inv_id})
    assert saved is not None
    assert saved["quantity"] == 100
    assert saved["status"] == "AVAILABLE"
    print("[OK] Test medicine inserted successfully.")

    # Update quantity to 10 (should trigger LOW_STOCK)
    new_status = calculate_stock_status(10, 25)
    await medicine_inventory_collection.update_one(
        {"inventory_id": test_inv_id},
        {"$set": {"quantity": 10, "status": new_status, "last_updated": time.time()}}
    )
    updated = await medicine_inventory_collection.find_one({"inventory_id": test_inv_id})
    assert updated["quantity"] == 10
    assert updated["status"] == "LOW_STOCK"
    print(f"[OK] Updated quantity to 10 -> status correctly changed to {updated['status']}")

    # Clean up test doc
    await medicine_inventory_collection.delete_one({"inventory_id": test_inv_id})
    print("[OK] Test inventory record cleaned up.")

    print("\n==================================================")
    print("  ALL 5 VERIFICATION SUITES PASSED SUCCESSFULLY!  ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
