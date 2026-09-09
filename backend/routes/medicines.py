from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import time
import uuid
import datetime
from database import (
    db,
    medicine_inventory_collection,
    healthcare_facilities_collection,
    notifications_collection,
    users_collection
)
from utils.jwt_handler import get_current_user
from services.facility_service import FacilityService, haversine_distance, DEFAULT_LAT, DEFAULT_LON

router = APIRouter()

# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------

class AddMedicineRequest(BaseModel):
    facility_id: Optional[str] = None
    medicine_name: str = Field(..., min_length=1)
    generic_name: Optional[str] = None
    strength: str = Field(..., min_length=1)  # e.g. "500mg", "10mg", "250mg/5ml"
    form: str = "Tablet"  # Tablet, Syrup, Injection, Capsule, Sachet, Inhaler, Drops, Ointment
    category: Optional[str] = "General"  # Analgesic, Antibiotic, Antidiabetic, etc.
    quantity: int = Field(..., ge=0)
    minimum_stock: int = Field(50, ge=0)
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None  # YYYY-MM-DD
    unit: Optional[str] = "Tablets"  # Tablets, Strips, Bottles, Vials, Sachets
    price_inr: Optional[str] = "₹0 (Govt Free Supply)"

class UpdateQuantityRequest(BaseModel):
    quantity: int = Field(..., ge=0)
    adjustment_reason: Optional[str] = "Routine stock check"

class UpdateMedicineRequest(BaseModel):
    medicine_name: Optional[str] = None
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=0)
    minimum_stock: Optional[int] = Field(None, ge=0)
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    unit: Optional[str] = None
    price_inr: Optional[str] = None

class ExplainMedicineRequest(BaseModel):
    medicine_name: str
    strength: Optional[str] = None

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def calculate_stock_status(quantity: int, minimum_stock: int) -> str:
    """
    Status formula:
    AVAILABLE = stock > minimum level
    LOW STOCK = stock <= minimum level AND stock > 0
    OUT OF STOCK = stock = 0
    """
    if quantity == 0:
        return "OUT_OF_STOCK"
    elif quantity <= minimum_stock:
        return "LOW_STOCK"
    else:
        return "AVAILABLE"

def format_timestamp_relative(ts: float) -> str:
    """Formats epoch timestamp to human-friendly string."""
    diff = time.time() - ts
    if diff < 60:
        return "Just now"
    elif diff < 3600:
        mins = int(diff / 60)
        return f"{mins} min{'s' if mins > 1 else ''} ago"
    elif diff < 86400:
        hrs = int(diff / 3600)
        return f"{hrs} hour{'s' if hrs > 1 else ''} ago"
    else:
        days = int(diff / 86400)
        return f"{days} day{'s' if days > 1 else ''} ago"

async def check_facility_authorization(facility_id: str, current_user: dict) -> Dict[str, Any]:
    """
    Validates that current user has authority to manage inventory for facility_id.
    Admins can manage any. Hospital staff can only manage their own facility.
    """
    role = current_user.get("role", "patient")
    email = current_user.get("sub", "")
    
    facility = await healthcare_facilities_collection.find_one({"facility_id": facility_id}, {"_id": 0})
    if not facility:
        raise HTTPException(status_code=404, detail=f"Healthcare facility {facility_id} not found.")

    if role == "admin":
        return facility

    if role == "hospital":
        # Check admin_email match or user facility_id
        if facility.get("admin_email") == email or current_user.get("facility_id") == facility_id:
            return facility
        raise HTTPException(status_code=403, detail="Unauthorized: You can only manage inventory for your linked healthcare facility.")

    raise HTTPException(status_code=403, detail="Forbidden: Only authorized facility administrators can manage medicine inventory.")

async def dispatch_stock_alert_notification(
    facility: Dict[str, Any],
    medicine_name: str,
    strength: str,
    quantity: int,
    minimum_stock: int,
    status: str
):
    """Generates low-stock or out-of-stock notification in existing notifications_collection."""
    admin_email = facility.get("admin_email")
    if not admin_email:
        # Fallback to general hospital user email if any
        hosp_user = await users_collection.find_one({"role": "hospital"}, {"email": 1})
        admin_email = hosp_user.get("email") if hosp_user else "admin@swasthyasetu.org"

    facility_id = facility.get("facility_id", "")
    facility_name = facility.get("name", "Healthcare Center")

    if status == "OUT_OF_STOCK":
        title = f"🚨 Out of Stock Alert: {medicine_name} {strength}"
        message = f"Critical inventory alert: {medicine_name} ({strength}) is completely OUT OF STOCK (0 units) at {facility_name}. Replenishment order required."
    elif status == "LOW_STOCK":
        title = f"⚠️ Low Stock Warning: {medicine_name} {strength}"
        message = f"Inventory threshold reached: {medicine_name} ({strength}) has only {quantity} units remaining at {facility_name} (minimum threshold: {minimum_stock})."
    else:
        return

    # Check if identical unread notification was issued in past 6 hours to prevent spam
    six_hours_ago = time.time() - 21600
    existing = await notifications_collection.find_one({
        "facility_id": facility_id,
        "title": title,
        "read": False,
        "timestamp": {"$gte": six_hours_ago}
    })
    if existing:
        return

    notif_doc = {
        "recipient_email": admin_email,
        "recipient_role": "hospital",
        "facility_id": facility_id,
        "facility_name": facility_name,
        "notification_type": status,
        "title": title,
        "message": message,
        "timestamp": time.time(),
        "read": False,
        "metadata": {
            "medicine_name": medicine_name,
            "strength": strength,
            "quantity": quantity,
            "minimum_stock": minimum_stock,
            "status": status
        }
    }
    await notifications_collection.insert_one(notif_doc)

# ---------------------------------------------------------------------------
# Seed Data & Seeding Helper
# ---------------------------------------------------------------------------

SEED_MEDICINES = [
    # Paracetamol 500mg across diverse facilities showing the prompt's exact example:
    # 🟢 PHC Badlapur — Available (350 units)
    # 🟢 UPHC Dharavi — Available (180 units)
    # 🟡 CHC Karjat — Low Stock (15 units, min 50)
    # 🔴 Sanjeevani District Hospital — Out of Stock (0 units, min 100)
    # 🟢 Apex Multi-Care Hospital — Available (420 units)
    {
        "facility_id": "FAC-002",
        "facility_name": "Gramin Primary Health Centre (PHC) Badlapur",
        "medicine_name": "Paracetamol",
        "generic_name": "Paracetamol / Acetaminophen",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antipyretic / Analgesic",
        "quantity": 350,
        "minimum_stock": 50,
        "batch_number": "PCM-2026-09A",
        "expiry_date": "2027-10-31",
        "unit": "Tablets",
        "price_inr": "₹0 (Jan Aushadhi / Govt Free)"
    },
    {
        "facility_id": "FAC-008",
        "facility_name": "Urban Primary Health Centre (UPHC) Dharavi",
        "medicine_name": "Paracetamol",
        "generic_name": "Paracetamol / Acetaminophen",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antipyretic / Analgesic",
        "quantity": 180,
        "minimum_stock": 40,
        "batch_number": "PCM-2026-04B",
        "expiry_date": "2027-08-31",
        "unit": "Tablets",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-003",
        "facility_name": "Community Health Centre (CHC) Karjat",
        "medicine_name": "Paracetamol",
        "generic_name": "Paracetamol / Acetaminophen",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antipyretic / Analgesic",
        "quantity": 15,
        "minimum_stock": 50,
        "batch_number": "PCM-2025-11X",
        "expiry_date": "2026-11-30",
        "unit": "Tablets",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "medicine_name": "Paracetamol",
        "generic_name": "Paracetamol / Acetaminophen",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antipyretic / Analgesic",
        "quantity": 0,
        "minimum_stock": 100,
        "batch_number": "PCM-2025-08R",
        "expiry_date": "2026-12-31",
        "unit": "Tablets",
        "price_inr": "₹0 (Civil Hospital Free Supply)"
    },
    {
        "facility_id": "FAC-004",
        "facility_name": "Apex Specialty Multi-Care Hospital",
        "medicine_name": "Paracetamol",
        "generic_name": "Paracetamol / Acetaminophen",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antipyretic / Analgesic",
        "quantity": 420,
        "minimum_stock": 80,
        "batch_number": "PCM-2026-06K",
        "expiry_date": "2028-02-28",
        "unit": "Tablets",
        "price_inr": "₹12.00 (Subsidized)"
    },

    # Amoxicillin 500mg
    {
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "medicine_name": "Amoxicillin",
        "generic_name": "Amoxicillin Trihydrate",
        "strength": "500mg",
        "form": "Capsule",
        "category": "Antibiotic",
        "quantity": 280,
        "minimum_stock": 60,
        "batch_number": "AMX-2026-02A",
        "expiry_date": "2027-09-30",
        "unit": "Capsules",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-002",
        "facility_name": "Gramin Primary Health Centre (PHC) Badlapur",
        "medicine_name": "Amoxicillin",
        "generic_name": "Amoxicillin Trihydrate",
        "strength": "500mg",
        "form": "Capsule",
        "category": "Antibiotic",
        "quantity": 18,
        "minimum_stock": 40,
        "batch_number": "AMX-2025-10C",
        "expiry_date": "2026-10-31",
        "unit": "Capsules",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-003",
        "facility_name": "Community Health Centre (CHC) Karjat",
        "medicine_name": "Amoxicillin",
        "generic_name": "Amoxicillin Trihydrate",
        "strength": "500mg",
        "form": "Capsule",
        "category": "Antibiotic",
        "quantity": 140,
        "minimum_stock": 50,
        "batch_number": "AMX-2026-03Z",
        "expiry_date": "2027-11-30",
        "unit": "Capsules",
        "price_inr": "₹0 (Govt Free Supply)"
    },

    # Metformin 500mg
    {
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "medicine_name": "Metformin",
        "generic_name": "Metformin Hydrochloride",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antidiabetic",
        "quantity": 450,
        "minimum_stock": 80,
        "batch_number": "MET-2026-05E",
        "expiry_date": "2028-04-30",
        "unit": "Tablets",
        "price_inr": "₹0 (NCD Clinic Free)"
    },
    {
        "facility_id": "FAC-002",
        "facility_name": "Gramin Primary Health Centre (PHC) Badlapur",
        "medicine_name": "Metformin",
        "generic_name": "Metformin Hydrochloride",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antidiabetic",
        "quantity": 0,
        "minimum_stock": 30,
        "batch_number": "MET-2025-07Q",
        "expiry_date": "2026-08-31",
        "unit": "Tablets",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-004",
        "facility_name": "Apex Specialty Multi-Care Hospital",
        "medicine_name": "Metformin",
        "generic_name": "Metformin Hydrochloride",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antidiabetic",
        "quantity": 310,
        "minimum_stock": 60,
        "batch_number": "MET-2026-01B",
        "expiry_date": "2027-12-31",
        "unit": "Tablets",
        "price_inr": "₹15.00 (Subsidized)"
    },

    # Cetirizine 10mg
    {
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "medicine_name": "Cetirizine",
        "generic_name": "Cetirizine Dihydrochloride",
        "strength": "10mg",
        "form": "Tablet",
        "category": "Antihistamine / Allergy",
        "quantity": 210,
        "minimum_stock": 40,
        "batch_number": "CTZ-2026-08D",
        "expiry_date": "2027-12-31",
        "unit": "Tablets",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-002",
        "facility_name": "Gramin Primary Health Centre (PHC) Badlapur",
        "medicine_name": "Cetirizine",
        "generic_name": "Cetirizine Dihydrochloride",
        "strength": "10mg",
        "form": "Tablet",
        "category": "Antihistamine / Allergy",
        "quantity": 25,
        "minimum_stock": 30,
        "batch_number": "CTZ-2025-09L",
        "expiry_date": "2026-11-30",
        "unit": "Tablets",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-007",
        "facility_name": "Sub-Centre Wavanje Panvel",
        "medicine_name": "Cetirizine",
        "generic_name": "Cetirizine Dihydrochloride",
        "strength": "10mg",
        "form": "Tablet",
        "category": "Antihistamine / Allergy",
        "quantity": 60,
        "minimum_stock": 20,
        "batch_number": "CTZ-2026-02H",
        "expiry_date": "2028-01-31",
        "unit": "Tablets",
        "price_inr": "₹0 (Sub-Centre Free)"
    },

    # Oral Rehydration Salts (ORS)
    {
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "medicine_name": "Oral Rehydration Salts (ORS)",
        "generic_name": "WHO Formula Electrolytes + Dextrose",
        "strength": "21.8g Sachet",
        "form": "Sachet",
        "category": "Essential Pediatric / Hydration",
        "quantity": 600,
        "minimum_stock": 100,
        "batch_number": "ORS-2026-07J",
        "expiry_date": "2028-06-30",
        "unit": "Sachets",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-002",
        "facility_name": "Gramin Primary Health Centre (PHC) Badlapur",
        "medicine_name": "Oral Rehydration Salts (ORS)",
        "generic_name": "WHO Formula Electrolytes + Dextrose",
        "strength": "21.8g Sachet",
        "form": "Sachet",
        "category": "Essential Pediatric / Hydration",
        "quantity": 120,
        "minimum_stock": 30,
        "batch_number": "ORS-2026-04V",
        "expiry_date": "2027-10-31",
        "unit": "Sachets",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-003",
        "facility_name": "Community Health Centre (CHC) Karjat",
        "medicine_name": "Oral Rehydration Salts (ORS)",
        "generic_name": "WHO Formula Electrolytes + Dextrose",
        "strength": "21.8g Sachet",
        "form": "Sachet",
        "category": "Essential Pediatric / Hydration",
        "quantity": 18,
        "minimum_stock": 50,
        "batch_number": "ORS-2025-12P",
        "expiry_date": "2026-10-15",
        "unit": "Sachets",
        "price_inr": "₹0 (Govt Free Supply)"
    },

    # Azithromycin 500mg
    {
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "medicine_name": "Azithromycin",
        "generic_name": "Azithromycin Dihydrate",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antibiotic",
        "quantity": 150,
        "minimum_stock": 40,
        "batch_number": "AZM-2026-03M",
        "expiry_date": "2027-12-31",
        "unit": "Tablets",
        "price_inr": "₹0 (Govt Free Supply)"
    },
    {
        "facility_id": "FAC-004",
        "facility_name": "Apex Specialty Multi-Care Hospital",
        "medicine_name": "Azithromycin",
        "generic_name": "Azithromycin Dihydrate",
        "strength": "500mg",
        "form": "Tablet",
        "category": "Antibiotic",
        "quantity": 8,
        "minimum_stock": 30,
        "batch_number": "AZM-2025-11W",
        "expiry_date": "2026-12-31",
        "unit": "Tablets",
        "price_inr": "₹28.00 (Subsidized)"
    },

    # Amlodipine 5mg
    {
        "facility_id": "FAC-001",
        "facility_name": "Sanjeevani District Civil Hospital",
        "medicine_name": "Amlodipine",
        "generic_name": "Amlodipine Besylate",
        "strength": "5mg",
        "form": "Tablet",
        "category": "Cardiovascular / Antihypertensive",
        "quantity": 380,
        "minimum_stock": 60,
        "batch_number": "AML-2026-05F",
        "expiry_date": "2028-03-31",
        "unit": "Tablets",
        "price_inr": "₹0 (NCD Clinic Free)"
    },
    {
        "facility_id": "FAC-002",
        "facility_name": "Gramin Primary Health Centre (PHC) Badlapur",
        "medicine_name": "Amlodipine",
        "generic_name": "Amlodipine Besylate",
        "strength": "5mg",
        "form": "Tablet",
        "category": "Cardiovascular / Antihypertensive",
        "quantity": 12,
        "minimum_stock": 25,
        "batch_number": "AML-2025-08T",
        "expiry_date": "2026-09-30",
        "unit": "Tablets",
        "price_inr": "₹0 (Govt Free Supply)"
    }
]

async def ensure_medicine_inventory_seeded():
    """Seed medicine inventory with realistic stocks across facilities."""
    try:
        count = await medicine_inventory_collection.count_documents({})
        if count == 0:
            now = time.time()
            docs_to_insert = []
            for item in SEED_MEDICINES:
                doc = dict(item)
                doc["inventory_id"] = f"MED-INV-{uuid.uuid4().hex[:8].upper()}"
                doc["status"] = calculate_stock_status(doc["quantity"], doc["minimum_stock"])
                doc["last_updated"] = now - (3600 * (len(docs_to_insert) % 12))  # Staggered update times
                doc["updated_by"] = "system_mesh@swasthyasetu.org"
                docs_to_insert.append(doc)
            
            await medicine_inventory_collection.insert_many(docs_to_insert)
            print(f"Successfully seeded {len(docs_to_insert)} medicine inventory records.")
    except Exception as e:
        print(f"Medicine seeding notice: {e}")

# ---------------------------------------------------------------------------
# PATIENT & PUBLIC ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/search")
async def search_medicines(
    query: Optional[str] = Query("", description="Medicine or generic name query"),
    category: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50)
):
    """
    Autocomplete/search suggestions for medicines across inventory.
    Returns unique medicine names, generic names, and strengths.
    """
    await ensure_medicine_inventory_seeded()
    filter_query: Dict[str, Any] = {}
    if query:
        filter_query["$or"] = [
            {"medicine_name": {"$regex": query.strip(), "$options": "i"}},
            {"generic_name": {"$regex": query.strip(), "$options": "i"}},
            {"category": {"$regex": query.strip(), "$options": "i"}}
        ]
    if category and category.lower() != "all":
        filter_query["category"] = {"$regex": category, "$options": "i"}

    cursor = medicine_inventory_collection.find(filter_query, {"_id": 0}).limit(limit * 2)
    seen = set()
    suggestions = []
    async for item in cursor:
        key = (item["medicine_name"], item.get("strength", ""))
        if key not in seen:
            seen.add(key)
            suggestions.append({
                "medicine_name": item["medicine_name"],
                "generic_name": item.get("generic_name", ""),
                "strength": item.get("strength", ""),
                "form": item.get("form", "Tablet"),
                "category": item.get("category", "General")
            })
            if len(suggestions) >= limit:
                break

    return {
        "count": len(suggestions),
        "query": query,
        "suggestions": suggestions
    }


@router.get("/availability")
async def check_medicine_availability(
    query: Optional[str] = Query(None, description="Medicine name or search phrase"),
    medicine_name: Optional[str] = Query(None, description="Exact or partial medicine name"),
    strength: Optional[str] = None,
    status: Optional[str] = Query(None, description="Filter: AVAILABLE, LOW_STOCK, OUT_OF_STOCK"),
    facility_type: Optional[str] = Query(None, description="Filter: hospital, phc, chc, sub_centre"),
    city: Optional[str] = Query(None, description="City / District filter"),
    user_lat: Optional[float] = Query(DEFAULT_LAT),
    user_lon: Optional[float] = Query(DEFAULT_LON),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    CORE PATIENT ENDPOINT:
    Finds nearby facilities stocking the requested medicine.
    Returns:
    - Real stock status (AVAILABLE, LOW_STOCK, OUT_OF_STOCK)
    - Calculated distance in km from user's GPS coords
    - Last updated timestamp and formatted relative time
    - Facility contact, address, coordinates, and Google Maps direction URL
    - Sorted nearest-first
    """
    await ensure_medicine_inventory_seeded()
    await FacilityService.get_all_facilities()  # Ensure seed facilities

    search_term = (query or medicine_name or "").strip()
    
    # Build medicine inventory filter
    inv_filter: Dict[str, Any] = {}
    if search_term:
        inv_filter["$or"] = [
            {"medicine_name": {"$regex": search_term, "$options": "i"}},
            {"generic_name": {"$regex": search_term, "$options": "i"}},
            {"category": {"$regex": search_term, "$options": "i"}}
        ]
    if strength:
        inv_filter["strength"] = {"$regex": strength.strip(), "$options": "i"}
    if status and status.upper() in ["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK"]:
        inv_filter["status"] = status.upper()

    cursor = medicine_inventory_collection.find(inv_filter, {"_id": 0})
    inventory_items = []
    async for item in cursor:
        inventory_items.append(item)

    # Collect distinct facility_ids
    facility_ids = list({item["facility_id"] for item in inventory_items})

    # Query healthcare_facilities
    fac_filter: Dict[str, Any] = {"facility_id": {"$in": facility_ids}}
    if facility_type and facility_type.lower() != "all":
        fac_filter["$or"] = [
            {"facility_type": facility_type.lower()},
            {"category": {"$regex": facility_type, "$options": "i"}},
            {"type": {"$regex": facility_type, "$options": "i"}}
        ]
    if city and city.lower() != "all":
        fac_filter["$or"] = [
            {"city": {"$regex": city, "$options": "i"}},
            {"district": {"$regex": city, "$options": "i"}}
        ]

    fac_cursor = healthcare_facilities_collection.find(fac_filter, {"_id": 0})
    facilities_map: Dict[str, Any] = {}
    async for f in fac_cursor:
        facilities_map[f["facility_id"]] = f

    # Join inventory items with facilities and calculate distance
    results = []
    now = time.time()
    
    available_count = 0
    low_stock_count = 0
    out_of_stock_count = 0

    for item in inventory_items:
        fac = facilities_map.get(item["facility_id"])
        if not fac:
            continue

        fac_lat = fac.get("latitude", DEFAULT_LAT)
        fac_lon = fac.get("longitude", DEFAULT_LON)
        dist_km = haversine_distance(
            user_lat or DEFAULT_LAT,
            user_lon or DEFAULT_LON,
            fac_lat,
            fac_lon
        )

        st = item.get("status") or calculate_stock_status(item["quantity"], item.get("minimum_stock", 50))
        if st == "AVAILABLE":
            available_count += 1
        elif st == "LOW_STOCK":
            low_stock_count += 1
        elif st == "OUT_OF_STOCK":
            out_of_stock_count += 1

        updated_ts = item.get("last_updated", now)
        updated_relative = format_timestamp_relative(updated_ts)
        updated_datetime_str = datetime.datetime.fromtimestamp(updated_ts).strftime("%d %b %Y, %I:%M %p")

        # Google Maps navigation URL
        directions_url = f"https://www.google.com/maps/dir/?api=1&destination={fac_lat},{fac_lon}"

        results.append({
            "inventory_id": item["inventory_id"],
            "medicine_name": item["medicine_name"],
            "generic_name": item.get("generic_name", ""),
            "strength": item.get("strength", ""),
            "form": item.get("form", "Tablet"),
            "category": item.get("category", "General"),
            "quantity": item["quantity"],
            "minimum_stock": item.get("minimum_stock", 50),
            "status": st,
            "unit": item.get("unit", "Tablets"),
            "batch_number": item.get("batch_number", "N/A"),
            "expiry_date": item.get("expiry_date", "N/A"),
            "price_inr": item.get("price_inr", "Free Govt Supply"),
            "last_updated": updated_ts,
            "last_updated_text": updated_relative,
            "last_updated_full": updated_datetime_str,
            "data_notice": "Facility-reported verified stock",
            "distance_km": dist_km,
            "facility": {
                "facility_id": fac["facility_id"],
                "name": fac["name"],
                "type": fac.get("type", "Healthcare Facility"),
                "category": fac.get("category", "General"),
                "facility_type": fac.get("facility_type", "hospital"),
                "address": fac.get("address", ""),
                "city": fac.get("city", "Mumbai"),
                "district": fac.get("district", "Mumbai"),
                "phone": fac.get("phone", "+91 22 2555 0199"),
                "emergency_phone": fac.get("emergency_phone", "108"),
                "operating_hours": fac.get("operating_hours", "24/7"),
                "latitude": fac_lat,
                "longitude": fac_lon,
                "distance_km": dist_km,
                "directions_url": directions_url
            }
        })

    # Sort results by distance ascending (nearest facilities first)
    results.sort(key=lambda r: r["distance_km"])

    return {
        "query": search_term,
        "total_results": len(results),
        "available_count": available_count,
        "low_stock_count": low_stock_count,
        "out_of_stock_count": out_of_stock_count,
        "user_coordinates": {"latitude": user_lat or DEFAULT_LAT, "longitude": user_lon or DEFAULT_LON},
        "results": results
    }

# ---------------------------------------------------------------------------
# FACILITY / HOSPITAL INVENTORY MANAGEMENT (RBAC Protected)
# ---------------------------------------------------------------------------

@router.get("/inventory/facility/{facility_id}")
async def get_facility_inventory(
    facility_id: str,
    search: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Facility staff / Admin view of their own facility medicine inventory.
    Provides metrics: Total Medicines, Low Stock, Out of Stock, Expiring Soon.
    """
    facility = await check_facility_authorization(facility_id, current_user)

    filter_query: Dict[str, Any] = {"facility_id": facility_id}
    if search:
        filter_query["$or"] = [
            {"medicine_name": {"$regex": search.strip(), "$options": "i"}},
            {"generic_name": {"$regex": search.strip(), "$options": "i"}},
            {"batch_number": {"$regex": search.strip(), "$options": "i"}}
        ]
    if status and status.upper() in ["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK"]:
        filter_query["status"] = status.upper()
    if category and category.lower() != "all":
        filter_query["category"] = {"$regex": category, "$options": "i"}

    cursor = medicine_inventory_collection.find(filter_query, {"_id": 0}).sort("medicine_name", 1)
    items = []
    
    total_count = 0
    available_count = 0
    low_stock_count = 0
    out_of_stock_count = 0
    expiring_soon_count = 0

    now_date = datetime.date.today()
    ninety_days_ahead = now_date + datetime.timedelta(days=90)

    async for item in cursor:
        st = item.get("status") or calculate_stock_status(item["quantity"], item.get("minimum_stock", 50))
        item["status"] = st
        item["last_updated_text"] = format_timestamp_relative(item.get("last_updated", time.time()))

        total_count += 1
        if st == "AVAILABLE":
            available_count += 1
        elif st == "LOW_STOCK":
            low_stock_count += 1
        elif st == "OUT_OF_STOCK":
            out_of_stock_count += 1

        # Check expiry
        exp_str = item.get("expiry_date")
        if exp_str:
            try:
                exp_dt = datetime.datetime.strptime(exp_str[:10], "%Y-%m-%d").date()
                if exp_dt <= ninety_days_ahead:
                    expiring_soon_count += 1
                    item["is_expiring_soon"] = True
                    item["days_to_expiry"] = (exp_dt - now_date).days
                else:
                    item["is_expiring_soon"] = False
            except Exception:
                item["is_expiring_soon"] = False
        else:
            item["is_expiring_soon"] = False

        items.append(item)

    return {
        "facility": {
            "facility_id": facility["facility_id"],
            "name": facility["name"],
            "admin_email": facility.get("admin_email")
        },
        "stats": {
            "total_medicines": total_count,
            "available_count": available_count,
            "low_stock_count": low_stock_count,
            "out_of_stock_count": out_of_stock_count,
            "expiring_soon_count": expiring_soon_count
        },
        "items": items
    }


@router.post("/inventory")
async def add_medicine_to_inventory(
    request: AddMedicineRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Authorized hospital staff adds a new medicine to their facility inventory.
    Automatically calculates status and triggers notification if low/out of stock.
    """
    # Resolve facility ID from request or user profile
    target_facility_id = request.facility_id
    if not target_facility_id:
        user_email = current_user["sub"]
        fac = await healthcare_facilities_collection.find_one({"admin_email": user_email}, {"facility_id": 1, "name": 1})
        if fac:
            target_facility_id = fac["facility_id"]
        else:
            target_facility_id = current_user.get("facility_id", "FAC-001")

    facility = await check_facility_authorization(target_facility_id, current_user)

    # Check for existing duplicate medicine in same facility
    existing = await medicine_inventory_collection.find_one({
        "facility_id": target_facility_id,
        "medicine_name": {"$regex": f"^{request.medicine_name.strip()}$", "$options": "i"},
        "strength": {"$regex": f"^{request.strength.strip()}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"{request.medicine_name} ({request.strength}) is already listed in this facility's inventory. Use the quantity update feature instead."
        )

    status = calculate_stock_status(request.quantity, request.minimum_stock)
    now = time.time()
    inventory_id = f"MED-INV-{uuid.uuid4().hex[:8].upper()}"

    doc = {
        "inventory_id": inventory_id,
        "facility_id": target_facility_id,
        "facility_name": facility.get("name", "Healthcare Facility"),
        "medicine_name": request.medicine_name.strip(),
        "generic_name": (request.generic_name or request.medicine_name).strip(),
        "strength": request.strength.strip(),
        "form": request.form,
        "category": request.category or "General",
        "quantity": request.quantity,
        "minimum_stock": request.minimum_stock,
        "status": status,
        "batch_number": request.batch_number or f"BAT-{uuid.uuid4().hex[:6].upper()}",
        "expiry_date": request.expiry_date or "2027-12-31",
        "unit": request.unit or "Tablets",
        "price_inr": request.price_inr or "₹0 (Govt Free Supply)",
        "last_updated": now,
        "updated_by": current_user["sub"]
    }

    await medicine_inventory_collection.insert_one(doc)
    doc.pop("_id", None)

    # Trigger notification if low or out of stock
    if status in ["LOW_STOCK", "OUT_OF_STOCK"]:
        await dispatch_stock_alert_notification(
            facility=facility,
            medicine_name=doc["medicine_name"],
            strength=doc["strength"],
            quantity=doc["quantity"],
            minimum_stock=doc["minimum_stock"],
            status=status
        )

    return doc


@router.put("/inventory/{inventory_id}/quantity")
async def update_medicine_quantity(
    inventory_id: str,
    request: UpdateQuantityRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Quick quantity adjustment for hospital staff (supports inline count or +/-).
    Recalculates status and automatically triggers alerts for low or zero stock.
    """
    item = await medicine_inventory_collection.find_one({"inventory_id": inventory_id})
    if not item:
        raise HTTPException(status_code=404, detail="Medicine inventory record not found.")

    facility = await check_facility_authorization(item["facility_id"], current_user)

    new_quantity = request.quantity
    min_stock = item.get("minimum_stock", 50)
    new_status = calculate_stock_status(new_quantity, min_stock)
    now = time.time()

    updates = {
        "quantity": new_quantity,
        "status": new_status,
        "last_updated": now,
        "updated_by": current_user["sub"]
    }

    await medicine_inventory_collection.update_one(
        {"inventory_id": inventory_id},
        {"$set": updates}
    )

    # Dispatch alerts if stock reached threshold or depleted
    if new_status in ["LOW_STOCK", "OUT_OF_STOCK"]:
        await dispatch_stock_alert_notification(
            facility=facility,
            medicine_name=item["medicine_name"],
            strength=item.get("strength", ""),
            quantity=new_quantity,
            minimum_stock=min_stock,
            status=new_status
        )

    updated_item = await medicine_inventory_collection.find_one({"inventory_id": inventory_id}, {"_id": 0})
    return updated_item


@router.put("/inventory/{inventory_id}")
async def update_medicine_details(
    inventory_id: str,
    request: UpdateMedicineRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Full edit of medicine record (threshold, batch, expiry, unit, etc.).
    """
    item = await medicine_inventory_collection.find_one({"inventory_id": inventory_id})
    if not item:
        raise HTTPException(status_code=404, detail="Medicine inventory record not found.")

    facility = await check_facility_authorization(item["facility_id"], current_user)

    updates: Dict[str, Any] = {
        "last_updated": time.time(),
        "updated_by": current_user["sub"]
    }

    if request.medicine_name is not None:
        updates["medicine_name"] = request.medicine_name.strip()
    if request.generic_name is not None:
        updates["generic_name"] = request.generic_name.strip()
    if request.strength is not None:
        updates["strength"] = request.strength.strip()
    if request.form is not None:
        updates["form"] = request.form
    if request.category is not None:
        updates["category"] = request.category
    if request.batch_number is not None:
        updates["batch_number"] = request.batch_number
    if request.expiry_date is not None:
        updates["expiry_date"] = request.expiry_date
    if request.unit is not None:
        updates["unit"] = request.unit
    if request.price_inr is not None:
        updates["price_inr"] = request.price_inr

    new_quantity = request.quantity if request.quantity is not None else item.get("quantity", 0)
    new_min = request.minimum_stock if request.minimum_stock is not None else item.get("minimum_stock", 50)
    updates["quantity"] = new_quantity
    updates["minimum_stock"] = new_min
    new_status = calculate_stock_status(new_quantity, new_min)
    updates["status"] = new_status

    await medicine_inventory_collection.update_one(
        {"inventory_id": inventory_id},
        {"$set": updates}
    )

    if new_status in ["LOW_STOCK", "OUT_OF_STOCK"]:
        await dispatch_stock_alert_notification(
            facility=facility,
            medicine_name=updates.get("medicine_name", item["medicine_name"]),
            strength=updates.get("strength", item.get("strength", "")),
            quantity=new_quantity,
            minimum_stock=new_min,
            status=new_status
        )

    updated_item = await medicine_inventory_collection.find_one({"inventory_id": inventory_id}, {"_id": 0})
    return updated_item


@router.delete("/inventory/{inventory_id}")
async def delete_medicine_from_inventory(
    inventory_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Removes a medicine item from the facility inventory."""
    item = await medicine_inventory_collection.find_one({"inventory_id": inventory_id})
    if not item:
        raise HTTPException(status_code=404, detail="Medicine record not found.")

    await check_facility_authorization(item["facility_id"], current_user)
    await medicine_inventory_collection.delete_one({"inventory_id": inventory_id})

    return {"message": f"Successfully removed {item['medicine_name']} from facility inventory.", "inventory_id": inventory_id}

# ---------------------------------------------------------------------------
# AI MEDICINE INFO & PRESCRIPTION SIMPLIFICATION
# STRICT CONSTRAINT:
# AI does NOT determine or invent stock levels. Stock levels ONLY come from MongoDB.
# AI is used solely to explain drug purpose, administration guidelines, and warnings.
# ---------------------------------------------------------------------------

@router.post("/ai-explain")
async def explain_medicine(
    request: ExplainMedicineRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Explains medicine clinical purpose, simplified instructions, and precautions.
    Strictly barred from hallucinating stock levels.
    """
    med = request.medicine_name.strip()
    strength = request.strength or ""

    # Check if Gemini/Groq service is available
    explanation = None
    try:
        from services.gemini_service import GeminiService
        prompt = (
            f"You are a clinical pharmacist assistant for the Indian healthcare network SwasthyaSetu.\n"
            f"Provide a clear, patient-friendly explanation for the medication: {med} {strength}.\n"
            f"CRITICAL RULE: DO NOT discuss or speculate about stock availability or pharmacy inventory.\n"
            f"Format response with these exact sections:\n"
            f"1. What it is used for (1-2 clear sentences)\n"
            f"2. How it should typically be taken (with food/water, general timing)\n"
            f"3. Key precautions and common side effects\n"
            f"4. Important note: Always follow your doctor's exact prescription."
        )
        explanation = await GeminiService.generate_content(prompt)
    except Exception as e:
        explanation = (
            f"{med} is a standard medication commonly prescribed for therapeutic clinical indications. "
            f"Please take this medication exactly as directed by your physician or as indicated on your official prescription. "
            f"Do not adjust your dose without medical consultation."
        )

    return {
        "medicine_name": med,
        "strength": strength,
        "explanation": explanation,
        "disclaimer": "AI provides educational medication guidance only and does not determine pharmacy stock or replace doctor consultations."
    }
