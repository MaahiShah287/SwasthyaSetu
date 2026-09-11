from motor.motor_asyncio import AsyncIOMotorClient
from config import Config

client = AsyncIOMotorClient(Config.MONGODB_URI)
db = client.get_database("swasthyasetu")

def get_database():
    return db

# Collections
users_collection = db.get_collection("users")
otp_collection = db.get_collection("otp_codes")
reports_collection = db.get_collection("reports")
claims_collection = db.get_collection("claims")
profile_collection = db.get_collection("profiles")
disease_reports_collection = db.get_collection("disease_reports")
datasets_collection = db.get_collection("datasets")
triage_history_collection = db.get_collection("triage_history")
healthcare_facilities_collection = db.get_collection("healthcare_facilities")
referrals_history_collection = db.get_collection("referrals_history")
doctors_collection = db.get_collection("doctors")
consultations_collection = db.get_collection("consultations")
appointments_collection = db.get_collection("appointments")
consultation_messages_collection = db.get_collection("consultation_messages")
doctor_schedules_collection = db.get_collection("doctor_schedules")
ambulances_collection = db.get_collection("ambulances")
ambulance_bookings_collection = db.get_collection("ambulance_bookings")
hospital_bookings_collection = db.get_collection("hospital_bookings")
notifications_collection = db.get_collection("notifications")
vaccinations_collection = db.get_collection("vaccinations")
vaccine_schedules_collection = db.get_collection("vaccine_schedules")
audit_logs_collection = db.get_collection("audit_logs")
follow_ups_collection = db.get_collection("follow_ups")

# Vaccination Tracking Collections
children_collection = db.get_collection("children")
vaccination_records_collection = db.get_collection("vaccination_records")
vaccination_reminders_collection = db.get_collection("vaccination_reminders")

# Medicine Inventory Collection
medicine_inventory_collection = db.get_collection("medicine_inventory")

# Diagnostic Services Collections
diagnostic_services_collection = db.get_collection("diagnostic_services")
diagnostic_recommendations_collection = db.get_collection("diagnostic_recommendations")

# Offline Sync Log Collection (for idempotency and sync history)
offline_sync_log_collection = db.get_collection("offline_sync_log")

# ASHA/ANM Community Health Worker Collections
asha_visits_collection = db.get_collection("asha_community_visits")
asha_case_reports_collection = db.get_collection("asha_case_reports")

async def init_indexes():
    """Create MongoDB indexes for performance and data integrity."""
    try:
        await vaccinations_collection.create_index([("patient_id", 1)])
        await vaccinations_collection.create_index([("patient_id", 1), ("next_due_date", 1)])
        await vaccinations_collection.create_index([("patient_id", 1), ("vaccination_date", 1)])
        await vaccinations_collection.create_index([("patient_id", 1), ("status", 1)])
        await audit_logs_collection.create_index([("patient_id", 1), ("timestamp", -1)])
        await audit_logs_collection.create_index([("user", 1), ("timestamp", -1)])
        
        # Follow-Up system indexes
        await follow_ups_collection.create_index([("patient_id", 1), ("due_date", 1)])
        await follow_ups_collection.create_index([("patient_id", 1), ("status", 1)])
        await follow_ups_collection.create_index([("doctor_id", 1), ("due_date", 1)])
        await follow_ups_collection.create_index([("referral_id", 1)])
        await follow_ups_collection.create_index([("consultation_id", 1)])
        await follow_ups_collection.create_index([("appointment_id", 1)])

        # Child Vaccination Tracking indexes
        await children_collection.create_index([("parent_id", 1)])
        await vaccination_records_collection.create_index([("child_id", 1)])
        await vaccination_records_collection.create_index([("parent_id", 1)])
        await vaccination_records_collection.create_index([("child_id", 1), ("vaccine_id", 1)])
        await vaccination_reminders_collection.create_index([("child_id", 1)])
        await vaccination_reminders_collection.create_index([("parent_id", 1)])
        await healthcare_facilities_collection.create_index([("facility_type", 1)])
        await healthcare_facilities_collection.create_index([("category", 1)])
        await healthcare_facilities_collection.create_index([("location", "2dsphere")])

        # Medicine Inventory indexes
        await medicine_inventory_collection.create_index([("facility_id", 1), ("medicine_name", 1)])
        await medicine_inventory_collection.create_index([("medicine_name", 1)])
        await medicine_inventory_collection.create_index([("generic_name", 1)])
        await medicine_inventory_collection.create_index([("status", 1)])
        await medicine_inventory_collection.create_index([("facility_id", 1)])
        await medicine_inventory_collection.create_index([("expiry_date", 1)])
        await medicine_inventory_collection.create_index([("last_updated", -1)])

        # Diagnostic Services indexes
        await diagnostic_services_collection.create_index(
            [("facility_id", 1), ("service_name", 1)], unique=True
        )
        await diagnostic_services_collection.create_index([("service_name", 1)])
        await diagnostic_services_collection.create_index([("availability", 1)])
        await diagnostic_services_collection.create_index([("category", 1)])
        await diagnostic_services_collection.create_index([("facility_id", 1)])
        await diagnostic_services_collection.create_index([("last_updated", -1)])

        # Diagnostic Recommendations indexes
        await diagnostic_recommendations_collection.create_index([("recommendation_id", 1)], unique=True)
        await diagnostic_recommendations_collection.create_index([("patient_email", 1), ("status", 1)])
        await diagnostic_recommendations_collection.create_index([("patient_email", 1), ("created_at", -1)])
        await diagnostic_recommendations_collection.create_index([("doctor_id", 1), ("created_at", -1)])
        await diagnostic_recommendations_collection.create_index([("consultation_id", 1)])
        await diagnostic_recommendations_collection.create_index([("appointment_id", 1)])

        # Offline Sync Log indexes (idempotency key and user queries)
        await offline_sync_log_collection.create_index([("local_id", 1)], unique=True)
        await offline_sync_log_collection.create_index([("user_id", 1), ("created_at", -1)])
        await offline_sync_log_collection.create_index([("sync_status", 1)])

        # ASHA/ANM Community Visit indexes
        await asha_visits_collection.create_index([("worker_email", 1), ("created_at", -1)])
        await asha_visits_collection.create_index([("patient_email", 1), ("visit_date", -1)])
        await asha_visits_collection.create_index([("visit_id", 1)], unique=True)
        await asha_visits_collection.create_index([("worker_email", 1), ("visit_date", 1)])

        # ASHA/ANM Case Report indexes
        await asha_case_reports_collection.create_index([("worker_email", 1), ("created_at", -1)])
        await asha_case_reports_collection.create_index([("patient_email", 1)])
        await asha_case_reports_collection.create_index([("severity", 1), ("status", 1)])
        await asha_case_reports_collection.create_index([("report_id", 1)], unique=True)
    except Exception as e:
        print(f"Warning: Index initialization note: {e}")


