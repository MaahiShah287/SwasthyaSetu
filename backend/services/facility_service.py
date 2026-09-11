import math
import time
from typing import List, Dict, Any, Optional, Tuple
from database import healthcare_facilities_collection

# Default coordinates: Mumbai / Rural Maharashtra region default fallback
DEFAULT_LAT = 19.0760
DEFAULT_LON = 72.8777

SHATABDI_HOSPITAL_GOVANDI = {
    "facility_id": "FAC-SHATABDI-GOVANDI",
    "name": "Shatabdi Hospital, Govandi",
    "type": "Municipal General Hospital",
    "category": "Hospital",
    "facility_type": "hospital",
    "city": "Mumbai",
    "district": "Mumbai Suburban",
    "state": "Maharashtra",
    "latitude": 19.0435,
    "longitude": 72.9090,
    "location": {
        "type": "Point",
        "coordinates": [72.9090, 19.0435]
    },
    "address": "Mt Mary Church Rd, Near Govandi Railway Station, Govandi East, Mumbai, Maharashtra 400088",
    "phone": "+91 22 2556 4022",
    "emergency_phone": "108",
    "operating_hours": "24/7 Emergency Care",
    "is_24x7_emergency": True,
    "emergency_24_7": True,
    "status": "Operational",
    "total_beds": 310,
    "available_beds": 42,
    "icu_beds_available": 5,
    "oxygen_beds_available": 18,
    "services": [
        "General consultation",
        "Emergency care",
        "24/7 Trauma Services",
        "Pediatric care",
        "Maternity and Neonatal Care",
        "Diagnostic testing",
        "Laboratory services",
        "Pharmacy",
        "Vaccination Services"
    ],
    "specialists": ["General Physician", "General Surgeon", "Gynecologist", "Pediatrician", "Emergency Medicine"],
    "has_lab": True,
    "has_pharmacy": True,
    "has_telemedicine": True,
    "is_demo_facility": True,
    "last_updated": time.time()
}

SEED_FACILITIES = [
    SHATABDI_HOSPITAL_GOVANDI,
    {
        "facility_id": "FAC-001",
        "name": "Sanjeevani District Civil Hospital",
        "type": "District Hospital",
        "category": "Hospital",
        "facility_type": "hospital",
        "district": "Mumbai City",
        "state": "Maharashtra",
        "latitude": 19.0820,
        "longitude": 72.8890,
        "location": {"type": "Point", "coordinates": [72.8890, 19.0820]},
        "address": "Civil Lines Road, Sector 4, Central Region",
        "phone": "+91 22 2555 0199",
        "emergency_phone": "108",
        "operating_hours": "24/7",
        "is_24x7_emergency": True,
        "status": "Operational",
        "total_beds": 250,
        "available_beds": 38,
        "icu_beds_available": 6,
        "oxygen_beds_available": 14,
        "services": [
            "General consultation",
            "Emergency care",
            "Pediatric care",
            "Women's health",
            "Diagnostic testing",
            "Laboratory services",
            "Specialist consultation",
            "Pharmacy",
            "Vaccination Services",
            "BCG", "Pentavalent", "OPV", "MR", "PCV"
        ],
        "specialists": ["Cardiologist", "General Surgeon", "Gynecologist", "Pediatrician", "Orthopedic Surgeon", "Emergency Medicine"],
        "has_lab": True,
        "has_pharmacy": True,
        "has_telemedicine": True,
        "telemedicine_url": None,
        "last_updated": time.time() - 3600
    },
    {
        "facility_id": "FAC-002",
        "name": "Gramin Primary Health Centre (PHC) Badlapur",
        "type": "Primary Health Centre (PHC)",
        "category": "PHC",
        "facility_type": "phc",
        "district": "Thane",
        "state": "Maharashtra",
        "latitude": 19.1650,
        "longitude": 73.2380,
        "location": {"type": "Point", "coordinates": [73.2380, 19.1650]},
        "address": "Post Office Square, Badlapur Rural",
        "phone": "+91 251 2690 112",
        "emergency_phone": "+91 251 2690 911",
        "operating_hours": "8:00 AM - 8:00 PM",
        "is_24x7_emergency": False,
        "status": "Operational",
        "total_beds": 12,
        "available_beds": 4,
        "icu_beds_available": 0,
        "oxygen_beds_available": 2,
        "services": [
            "General consultation",
            "Pediatric care",
            "Women's health",
            "Pharmacy",
            "Telemedicine",
            "Routine Child Immunization",
            "BCG", "bOPV", "Pentavalent", "Rotavirus"
        ],
        "specialists": ["General Physician", "ANM/Nurse Midwife"],
        "has_lab": False,
        "has_pharmacy": True,
        "has_telemedicine": True,
        "telemedicine_url": None,
        "last_updated": time.time() - 1800
    },
    {
        "facility_id": "FAC-003",
        "name": "Community Health Centre (CHC) Karjat",
        "type": "Community Health Centre (CHC)",
        "category": "CHC",
        "facility_type": "chc",
        "district": "Raigad",
        "state": "Maharashtra",
        "latitude": 18.9100,
        "longitude": 73.3280,
        "location": {"type": "Point", "coordinates": [73.3280, 18.9100]},
        "address": "Station Road, Karjat East",
        "phone": "+91 2148 222 045",
        "emergency_phone": "108",
        "operating_hours": "24/7",
        "is_24x7_emergency": True,
        "status": "Operational",
        "total_beds": 40,
        "available_beds": 9,
        "icu_beds_available": 1,
        "oxygen_beds_available": 5,
        "services": [
            "General consultation",
            "Emergency care",
            "Pediatric care",
            "Women's health",
            "Diagnostic testing",
            "Laboratory services",
            "Pharmacy",
            "Universal Immunization Programme",
            "BCG", "Pentavalent", "fIPV", "PCV", "MR"
        ],
        "specialists": ["General Surgeon", "Gynecologist", "Pediatrician"],
        "has_lab": True,
        "has_pharmacy": True,
        "has_telemedicine": False,
        "telemedicine_url": None,
        "last_updated": time.time() - 7200
    },
    {
        "facility_id": "FAC-004",
        "name": "Apex Specialty Multi-Care Hospital",
        "type": "Tertiary Specialty Hospital",
        "category": "Hospital",
        "facility_type": "hospital",
        "district": "Mumbai Suburban",
        "state": "Maharashtra",
        "latitude": 19.0550,
        "longitude": 72.8310,
        "location": {"type": "Point", "coordinates": [72.8310, 19.0550]},
        "address": "SV Road, Bandra West",
        "phone": "+91 22 6100 9000",
        "emergency_phone": "+91 22 6100 9999",
        "operating_hours": "24/7",
        "is_24x7_emergency": True,
        "status": "Operational",
        "total_beds": 450,
        "available_beds": 62,
        "icu_beds_available": 12,
        "oxygen_beds_available": 28,
        "services": [
            "General consultation",
            "Emergency care",
            "Pediatric care",
            "Women's health",
            "Diagnostic testing",
            "Laboratory services",
            "Specialist consultation",
            "Pharmacy",
            "Pediatric Immunization Hub"
        ],
        "specialists": ["Neurologist", "Cardiologist", "Oncologist", "Pediatric Surgeon", "Trauma Specialist", "Pulmonologist"],
        "has_lab": True,
        "has_pharmacy": True,
        "has_telemedicine": True,
        "telemedicine_url": None,
        "last_updated": time.time() - 900
    },
    {
        "facility_id": "FAC-005",
        "name": "Seva Rural Tele-Clinic & Pharmacy",
        "type": "Telemedicine Hub & Pharmacy",
        "category": "Telemedicine",
        "facility_type": "telemedicine",
        "district": "Thane",
        "state": "Maharashtra",
        "latitude": 19.2100,
        "longitude": 73.1500,
        "location": {"type": "Point", "coordinates": [73.1500, 19.2100]},
        "address": "Bazaar Peth, Shahapur",
        "phone": "+91 2527 240 100",
        "emergency_phone": "+91 2527 240 101",
        "operating_hours": "9:00 AM - 9:00 PM",
        "is_24x7_emergency": False,
        "status": "Operational",
        "total_beds": 0,
        "available_beds": 0,
        "icu_beds_available": 0,
        "oxygen_beds_available": 0,
        "services": [
            "General consultation",
            "Pharmacy",
            "Telemedicine"
        ],
        "specialists": ["Remote General Physician", "Tele-Pediatrician"],
        "has_lab": False,
        "has_pharmacy": True,
        "has_telemedicine": True,
        "telemedicine_url": None,
        "last_updated": time.time() - 172800
    },
    {
        "facility_id": "FAC-006",
        "name": "Lifeline Diagnostic & Clinical Lab",
        "type": "Diagnostic Center",
        "category": "Lab",
        "facility_type": "lab",
        "district": "Mumbai Suburban",
        "state": "Maharashtra",
        "latitude": 19.1100,
        "longitude": 72.9000,
        "location": {"type": "Point", "coordinates": [72.9000, 19.1100]},
        "address": "LBS Marg, Ghatkopar West",
        "phone": "+91 22 2500 4433",
        "emergency_phone": "+91 22 2500 4434",
        "operating_hours": "7:00 AM - 10:00 PM",
        "is_24x7_emergency": False,
        "status": "Operational",
        "total_beds": 0,
        "available_beds": 0,
        "icu_beds_available": 0,
        "oxygen_beds_available": 0,
        "services": [
            "Diagnostic testing",
            "Laboratory services"
        ],
        "specialists": ["Pathologist", "Radiologist"],
        "has_lab": True,
        "has_pharmacy": False,
        "has_telemedicine": False,
        "telemedicine_url": None,
        "last_updated": time.time() - 14400
    },
    {
        "facility_id": "FAC-007",
        "name": "District Urban Immunization Centre & Maternity Hospital",
        "type": "Vaccination Centre",
        "category": "Vaccination Centre",
        "facility_type": "vaccination_centre",
        "district": "Mumbai City",
        "state": "Maharashtra",
        "latitude": 19.0178,
        "longitude": 72.8478,
        "location": {"type": "Point", "coordinates": [72.8478, 19.0178]},
        "address": "Dadar West, Near Railway Station",
        "phone": "+91 22 2413 5200",
        "emergency_phone": "108",
        "operating_hours": "8:30 AM - 5:00 PM (Mon - Sat)",
        "is_24x7_emergency": False,
        "status": "Operational",
        "total_beds": 20,
        "available_beds": 5,
        "icu_beds_available": 0,
        "oxygen_beds_available": 2,
        "services": [
            "Government NIS Vaccination Hub",
            "BCG", "bOPV-0", "Hepatitis B Birth Dose",
            "Pentavalent (1-3)", "fIPV", "RVV", "PCV",
            "MR-1 & MR-2", "JE Vaccine", "DPT Booster", "Td Vaccine"
        ],
        "specialists": ["Pediatrician", "Immunization Medical Officer", "Public Health Nurse"],
        "has_lab": True,
        "has_pharmacy": True,
        "has_telemedicine": False,
        "telemedicine_url": None,
        "last_updated": time.time() - 1800
    },
    {
        "facility_id": "FAC-008",
        "name": "Urban Primary Health Centre (UPHC) Immunization Clinic",
        "type": "Vaccination Centre",
        "category": "Vaccination Centre",
        "facility_type": "vaccination_centre",
        "district": "Mumbai Suburban",
        "state": "Maharashtra",
        "latitude": 19.0650,
        "longitude": 72.8790,
        "location": {"type": "Point", "coordinates": [72.8790, 19.0650]},
        "address": "SG Barve Marg, Kurla East",
        "phone": "+91 22 2522 1104",
        "emergency_phone": "108",
        "operating_hours": "9:00 AM - 4:00 PM (Daily)",
        "is_24x7_emergency": False,
        "status": "Operational",
        "total_beds": 10,
        "available_beds": 3,
        "icu_beds_available": 0,
        "oxygen_beds_available": 1,
        "services": [
            "National Immunization Schedule (NIS)",
            "Newborn Vaccination", "BCG", "Hepatitis B",
            "Pentavalent", "fIPV", "Rotavirus", "PCV",
            "Measles-Rubella (MR)", "JE 1 & 2", "Vitamin A Doses"
        ],
        "specialists": ["Medical Officer", "Auxiliary Nurse Midwife (ANM)"],
        "has_lab": True,
        "has_pharmacy": True,
        "has_telemedicine": True,
        "telemedicine_url": None,
        "last_updated": time.time() - 3600
    },
    {
        "facility_id": "FAC-009",
        "name": "Model Maternal & Child Health Immunization Hub",
        "type": "Vaccination Centre",
        "category": "Vaccination Centre",
        "facility_type": "vaccination_centre",
        "district": "Thane",
        "state": "Maharashtra",
        "latitude": 19.1980,
        "longitude": 72.9780,
        "location": {"type": "Point", "coordinates": [72.9780, 19.1980]},
        "address": "Eastern Express Highway, Thane West",
        "phone": "+91 22 2533 8899",
        "emergency_phone": "108",
        "operating_hours": "8:00 AM - 6:00 PM",
        "is_24x7_emergency": False,
        "status": "Operational",
        "total_beds": 30,
        "available_beds": 8,
        "icu_beds_available": 2,
        "oxygen_beds_available": 4,
        "services": [
            "Free Government Child Vaccines",
            "BCG", "bOPV", "Hepatitis B", "Pentavalent",
            "fIPV", "RVV", "PCV Booster", "MR Vaccine",
            "DPT Booster 1 & 2", "Td 10y & 16y"
        ],
        "specialists": ["Consultant Pediatrician", "Child Health Specialist", "Vaccine Officer"],
        "has_lab": True,
        "has_pharmacy": True,
        "has_telemedicine": True,
        "telemedicine_url": None,
        "last_updated": time.time() - 900
    },
    {
        "facility_id": "FAC-010",
        "name": "Sub-Centre Immunization Point Badlapur Rural",
        "type": "Sub-Centre",
        "category": "Sub-Centre",
        "facility_type": "sub_centre",
        "district": "Thane",
        "state": "Maharashtra",
        "latitude": 19.1680,
        "longitude": 73.2420,
        "location": {"type": "Point", "coordinates": [73.2420, 19.1680]},
        "address": "Gram Panchayat Bhawan, Badlapur East",
        "phone": "+91 251 2690 115",
        "emergency_phone": "108",
        "operating_hours": "9:00 AM - 2:00 PM (Immunization Days)",
        "is_24x7_emergency": False,
        "status": "Operational",
        "total_beds": 4,
        "available_beds": 2,
        "icu_beds_available": 0,
        "oxygen_beds_available": 0,
        "services": [
            "Rural Child Immunization",
            "BCG", "bOPV", "Pentavalent", "fIPV", "Vitamin A"
        ],
        "specialists": ["ANM Nurse", "MPW Healthcare Worker"],
        "has_lab": False,
        "has_pharmacy": True,
        "has_telemedicine": False,
        "telemedicine_url": None,
        "last_updated": time.time() - 14400
    }
]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two GPS coordinates."""
    R = 6371.0  # Earth radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return round(distance, 2)


def format_data_freshness(timestamp: float) -> Tuple[str, bool]:
    """Returns human readable freshness text and boolean indicating if data is stale (> 24 hours)."""
    now = time.time()
    diff = max(0, int(now - timestamp))

    is_stale = diff >= 86400  # 24 hours

    if diff < 3600:
        mins = max(1, diff // 60)
        text = f"Updated {mins} mins ago"
    elif diff < 86400:
        hours = diff // 3600
        text = f"Updated {hours} hours ago"
    else:
        days = diff // 86400
        text = f"Availability data may be outdated (Last updated {days} days ago)"

    return text, is_stale


class FacilityService:
    @staticmethod
    async def ensure_seeded():
        """Ensure database has facility seed records including constant Shatabdi Hospital."""
        try:
            count = await healthcare_facilities_collection.count_documents({})
            if count == 0:
                print("Seeding healthcare facilities collection with initial rural & urban dataset...")
                await healthcare_facilities_collection.insert_many(SEED_FACILITIES)
                print(f"Successfully seeded {len(SEED_FACILITIES)} facilities.")
            else:
                # Ensure constant Shatabdi Hospital, Govandi exists
                shatabdi = await healthcare_facilities_collection.find_one({
                    "$or": [
                        {"facility_id": "FAC-SHATABDI-GOVANDI"},
                        {"name": {"$regex": "Shatabdi Hospital", "$options": "i"}}
                    ]
                })
                if not shatabdi:
                    await healthcare_facilities_collection.insert_one(SHATABDI_HOSPITAL_GOVANDI)
                    print("Seeded constant demo facility: Shatabdi Hospital, Govandi.")

                # Populate location GeoJSON field for documents missing it
                async for fac in healthcare_facilities_collection.find({"location": {"$exists": False}}):
                    lat = fac.get("latitude", DEFAULT_LAT)
                    lon = fac.get("longitude", DEFAULT_LON)
                    await healthcare_facilities_collection.update_one(
                        {"_id": fac["_id"]},
                        {"$set": {"location": {"type": "Point", "coordinates": [lon, lat]}}}
                    )
        except Exception as e:
            print(f"Error seeding healthcare facilities: {e}")

    @staticmethod
    async def get_all_facilities() -> List[Dict[str, Any]]:
        await FacilityService.ensure_seeded()
        cursor = healthcare_facilities_collection.find({}, {"_id": 0})
        facilities = []
        async for doc in cursor:
            facilities.append(doc)
        return facilities

    @staticmethod
    async def update_facility_status(facility_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        updates["last_updated"] = time.time()
        res = await healthcare_facilities_collection.find_one_and_update(
            {"facility_id": facility_id},
            {"$set": updates},
            return_document=True
        )
        if res:
            res.pop("_id", None)
        return res

    @staticmethod
    def calculate_match_score(
        facility: Dict[str, Any],
        required_service: str,
        urgency_level: str,
        user_lat: float,
        user_lon: float
    ) -> Dict[str, Any]:
        """
        Transparent Multi-Factor Scoring Mechanism (0 - 100 points)
        
        Factor Breakdown:
        1. Service Match (Max 35 pts)
        2. Urgency Compatibility & Emergency Readiness (Max 25 pts)
        3. Distance Proximity (Max 20 pts)
        4. Operational Status & Availability (Max 10 pts)
        5. Facility Capability & Resources (Max 10 pts)
        6. Stale Data Penalty (-10 pts if data > 24 hours old)
        """
        facility_services = [s.lower() for s in facility.get("services", [])]
        req_svc_lower = required_service.lower()

        # 1. Service Match Score (Max 35)
        service_score = 0
        if req_svc_lower in facility_services:
            service_score = 35
        elif any(s in req_svc_lower or req_svc_lower in s for s in facility_services):
            service_score = 25
        elif "general consultation" in req_svc_lower or req_svc_lower == "general consultation":
            if "general consultation" in facility_services:
                service_score = 35
            else:
                service_score = 15
        else:
            service_score = 0

        # 2. Urgency Compatibility & Emergency Readiness (Max 25)
        urgency_score = 0
        is_emergency = urgency_level == "EMERGENCY"
        is_urgent = urgency_level == "URGENT"

        if is_emergency:
            if facility.get("is_24x7_emergency") and facility.get("status") == "Operational":
                urgency_score = 25
            elif "emergency care" in facility_services:
                urgency_score = 18
            elif facility.get("icu_beds_available", 0) > 0:
                urgency_score = 15
            else:
                urgency_score = 5
        elif is_urgent:
            if facility.get("status") == "Operational":
                urgency_score = 25
            elif facility.get("is_24x7_emergency"):
                urgency_score = 20
            else:
                urgency_score = 12
        else:
            # Routine / Self-care: Operational general clinic / hospital
            if facility.get("status") == "Operational":
                urgency_score = 25
            else:
                urgency_score = 10

        # 3. Distance Proximity Score (Max 20)
        dist_km = haversine_distance(
            user_lat, user_lon,
            facility.get("latitude", DEFAULT_LAT), facility.get("longitude", DEFAULT_LON)
        )
        if dist_km <= 5.0:
            distance_score = 20
        elif dist_km <= 15.0:
            distance_score = 16
        elif dist_km <= 30.0:
            distance_score = 12
        elif dist_km <= 60.0:
            distance_score = 8
        else:
            distance_score = 4

        # 4. Operational Status & Availability (Max 10)
        availability_score = 0
        status = facility.get("status", "Operational")
        if status == "Operational":
            availability_score += 5
            if facility.get("available_beds", 0) > 0 or facility.get("has_telemedicine"):
                availability_score += 5
        elif status == "Limited Services":
            availability_score = 4

        # 5. Facility Capability & Resources (Max 10)
        capability_score = 0
        if facility.get("has_lab"):
            capability_score += 3
        if facility.get("has_pharmacy"):
            capability_score += 3
        if len(facility.get("specialists", [])) > 2:
            capability_score += 4

        # 6. Data Freshness Penalty
        freshness_text, is_stale = format_data_freshness(facility.get("last_updated", time.time()))
        stale_penalty = 10 if is_stale else 0

        # Total Raw Score
        raw_score = service_score + urgency_score + distance_score + availability_score + capability_score - stale_penalty
        total_score = max(0, min(100, raw_score))

        # Formulate accurate rationale based strictly on database fields
        reasons = []
        if service_score >= 30:
            reasons.append(f"Provides requested service '{required_service}'")
        
        # Only highlight 24/7 ER if the patient actually required EMERGENCY care
        if is_emergency and facility.get("is_24x7_emergency"):
            reasons.append("Equipped with 24/7 emergency response & acute care capabilities")
        
        if dist_km <= 15.0:
            reasons.append(f"Nearby location ({dist_km} km away)")
        
        if facility.get("available_beds", 0) > 0:
            reasons.append(f"Inpatient capacity: {facility.get('available_beds')} / {facility.get('total_beds')} beds (Last reported)")
        
        if facility.get("has_telemedicine"):
            reasons.append("Supports remote telemedicine consultation")
        
        if is_stale:
            reasons.append("Warning: Facility availability data has not been updated in > 24 hours")

        rationale = ". ".join(reasons) + "." if reasons else "Provides basic general healthcare services."

        return {
            "facility": facility,
            "distance_km": dist_km,
            "total_score": total_score,
            "match_percentage": total_score,
            "rationale": rationale,
            "data_freshness_text": freshness_text,
            "is_stale": is_stale,
            "score_breakdown": {
                "service_match": service_score,
                "urgency_compatibility": urgency_score,
                "distance_proximity": distance_score,
                "availability": availability_score,
                "capability": capability_score,
                "stale_data_penalty": stale_penalty
            }
        }

    @staticmethod
    async def recommend_care_pathway(
        required_service: str,
        urgency_level: str,
        user_lat: float = DEFAULT_LAT,
        user_lon: float = DEFAULT_LON
    ) -> Dict[str, Any]:
        """
        Server-side facility matching & transparent care pathway generation.
        Strict rule: Facility availability comes purely from database records.
        """
        all_facilities = await FacilityService.get_all_facilities()

        scored_facilities = []
        for fac in all_facilities:
            res = FacilityService.calculate_match_score(
                fac, required_service, urgency_level, user_lat, user_lon
            )
            scored_facilities.append(res)

        # Sort by total_score descending, then distance ascending
        scored_facilities.sort(key=lambda x: (x["total_score"], -x["distance_km"]), reverse=True)

        # Filter suitable matches (score >= 40 AND service_match >= 20)
        suitable_matches = [
            f for f in scored_facilities
            if f["total_score"] >= 40 and f["score_breakdown"]["service_match"] >= 20
        ]


        best_match = suitable_matches[0] if len(suitable_matches) > 0 else None
        second_option = suitable_matches[1] if len(suitable_matches) > 1 else None
        third_option = suitable_matches[2] if len(suitable_matches) > 2 else None


        has_suitable_match = best_match is not None

        # Nearest fallback options if no suitable match found
        fallback_options = []
        if not has_suitable_match:
            # Sort pure distance for nearest available general options
            sorted_by_dist = sorted(scored_facilities, key=lambda x: x["distance_km"])
            fallback_options = sorted_by_dist[:3]

        return {
            "required_service": required_service,
            "urgency_level": urgency_level,
            "has_suitable_match": has_suitable_match,
            "best_match": best_match,
            "second_option": second_option,
            "third_option": third_option,
            "fallback_options": fallback_options,
            "no_match_message": None if has_suitable_match else f"No facility directly specializing in '{required_service}' with high compatibility was found within immediate range. Below are the nearest available operational healthcare centers.",
            "patient_location": {"lat": user_lat, "lon": user_lon}
        }
