import time
import uuid
from typing import Any, Dict, List, Optional, Union
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from database import (
    children_collection,
    disease_reports_collection,
    follow_ups_collection,
    offline_sync_log_collection,
    profile_collection,
    referrals_history_collection,
    users_collection,
    vaccination_records_collection,
    vaccinations_collection,
)
from utils.jwt_handler import get_current_user

router = APIRouter()


class SyncItem(BaseModel):
    local_id: str = Field(..., description="Client-generated unique UUID for idempotency")
    record_type: str = Field(
        ...,
        description=(
            "Type of record: vaccination_record, child_registration, follow_up, "
            "visit_note, health_case_report, referral_draft, profile_update, emergency_profile"
        ),
    )
    endpoint: Optional[str] = None
    method: Optional[str] = "POST"
    payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[float] = None
    client_updated_at: Optional[float] = None


class BatchSyncRequest(BaseModel):
    items: List[SyncItem]


class ConflictResolveRequest(BaseModel):
    local_id: str
    resolution: str = Field(..., description="'USE_CLIENT' (overwrite) or 'USE_SERVER' (discard local)")


def clean_mongo_doc(doc: Optional[dict]) -> Optional[dict]:
    """Strip or convert ObjectId for clean JSON serialization."""
    if not doc:
        return None
    cleaned = dict(doc)
    if "_id" in cleaned:
        cleaned["_id"] = str(cleaned["_id"])
    return cleaned


async def process_single_sync_item(item: SyncItem, current_user: dict) -> dict:
    user_email = current_user.get("sub", "")
    role = current_user.get("role", "patient")
    now = time.time()

    # 1. Idempotency Check: check if local_id was already processed
    existing_sync = await offline_sync_log_collection.find_one({"local_id": item.local_id})
    if existing_sync:
        if existing_sync.get("sync_status") == "SYNCED":
            return {
                "local_id": item.local_id,
                "status": "DUPLICATE",
                "server_id": existing_sync.get("server_id"),
                "record_type": item.record_type,
                "message": "Record already processed and synced.",
            }
        elif existing_sync.get("sync_status") == "CONFLICT":
            return {
                "local_id": item.local_id,
                "status": "CONFLICT",
                "server_data": existing_sync.get("server_data"),
                "client_data": existing_sync.get("client_data"),
                "message": "Record is currently marked as CONFLICT.",
            }

    record_type = item.record_type.lower()
    payload = item.payload or {}
    server_id = None
    conflict_detected = False
    conflict_server_doc = None

    try:
        # -------------------------------------------------------------
        # 1. Child Registration (Vaccination Module)
        # -------------------------------------------------------------
        if record_type in ["child_registration", "child"]:
            child_name = str(payload.get("name") or "").strip()
            dob = str(payload.get("date_of_birth") or payload.get("dob") or "").strip()
            if not child_name or not dob:
                raise ValueError("Child name and date_of_birth are required")

            # Check if this child already exists for this parent
            existing_child = await children_collection.find_one({
                "parent_id": user_email,
                "name": {"$regex": f"^{child_name}$", "$options": "i"},
                "date_of_birth": dob
            })
            if existing_child:
                server_id = str(existing_child["_id"])
            else:
                child_doc = {
                    "parent_id": user_email,
                    "name": child_name,
                    "date_of_birth": dob,
                    "gender": payload.get("gender") or "unspecified",
                    "location": payload.get("location") or "",
                    "district": payload.get("district") or "",
                    "state": payload.get("state") or "",
                    "blood_group": payload.get("blood_group") or "Unknown",
                    "is_je_endemic": payload.get("is_je_endemic") or False,
                    "local_id": item.local_id,
                    "created_at": item.created_at or now,
                    "updated_at": now,
                }
                res = await children_collection.insert_one(child_doc)
                server_id = str(res.inserted_id)

        # -------------------------------------------------------------
        # 2. Vaccination Record (Child or Adult)
        # -------------------------------------------------------------
        elif record_type in ["vaccination_record", "vaccine"]:
            child_id = payload.get("child_id")
            vaccine_id = payload.get("vaccine_id") or payload.get("vaccine_name") or "VAC-RECORD"
            admin_date = payload.get("administered_date") or payload.get("vaccination_date")

            if child_id:
                # Child vaccination
                child = None
                if ObjectId.is_valid(child_id):
                    child = await children_collection.find_one({"_id": ObjectId(child_id)})
                if not child:
                    child = await children_collection.find_one({"local_id": child_id})

                target_child_id = str(child["_id"]) if child else child_id

                rec_doc = {
                    "child_id": target_child_id,
                    "parent_id": user_email,
                    "vaccine_id": vaccine_id,
                    "vaccine_name": payload.get("vaccine_name") or vaccine_id,
                    "administered_date": admin_date or time.strftime("%Y-%m-%d"),
                    "facility_id": payload.get("facility_id") or "",
                    "facility_name": payload.get("facility_name") or "Field Healthcare",
                    "notes": payload.get("notes") or "",
                    "dose": payload.get("dose") or "Dose 1",
                    "status": "COMPLETED",
                    "local_id": item.local_id,
                    "created_at": item.created_at or now,
                    "updated_at": now,
                }
                res = await vaccination_records_collection.update_one(
                    {"child_id": target_child_id, "vaccine_id": vaccine_id},
                    {"$set": rec_doc},
                    upsert=True,
                )
                server_id = f"child_vac_{vaccine_id}"
            else:
                # Adult vaccination record
                vac_doc = {
                    "patient_id": user_email,
                    "vaccine_name": payload.get("vaccine_name") or vaccine_id,
                    "dose_number": payload.get("dose_number") or 1,
                    "vaccination_date": admin_date or time.strftime("%Y-%m-%d"),
                    "facility_name": payload.get("facility_name") or "Field Healthcare",
                    "batch_number": payload.get("batch_number") or "N/A",
                    "administered_by": payload.get("administered_by") or f"{user_email} (Offline Sync)",
                    "status": "COMPLETED",
                    "local_id": item.local_id,
                    "created_at": item.created_at or now,
                    "updated_at": now,
                }
                res = await vaccinations_collection.insert_one(vac_doc)
                server_id = str(res.inserted_id)

        # -------------------------------------------------------------
        # 3. Follow-Up Record or Note
        # -------------------------------------------------------------
        elif record_type in ["follow_up", "followup", "followup_note"]:
            target_patient = payload.get("patient_id") or user_email
            follow_up_id = payload.get("follow_up_id")

            if follow_up_id:
                # Update existing follow up
                existing_doc = await follow_ups_collection.find_one({"follow_up_id": follow_up_id})
                if existing_doc:
                    # Conflict check: did server record get updated more recently than offline edit?
                    server_updated = existing_doc.get("updated_at", 0)
                    client_ts = item.client_updated_at or item.created_at or 0
                    if server_updated > client_ts + 2.0:  # 2s clock skew grace
                        conflict_detected = True
                        conflict_server_doc = clean_mongo_doc(existing_doc)

                if not conflict_detected:
                    update_fields = {
                        "notes": payload.get("notes") or payload.get("doctor_notes") or "",
                        "updated_at": now,
                    }
                    if payload.get("status"):
                        update_fields["status"] = payload["status"]
                    if payload.get("due_date"):
                        update_fields["due_date"] = payload["due_date"]

                    await follow_ups_collection.update_one(
                        {"follow_up_id": follow_up_id},
                        {"$set": update_fields}
                    )
                    server_id = follow_up_id
            else:
                # Create new follow up
                new_fid = f"FLP-{uuid.uuid4().hex[:8].upper()}"
                due_date = payload.get("due_date") or time.strftime("%Y-%m-%d")
                tp = (payload.get("follow_up_type") or "ROUTINE_CHECKUP").upper()
                doc = {
                    "follow_up_id": new_fid,
                    "patient_id": target_patient,
                    "created_by": user_email,
                    "created_by_role": role,
                    "doctor_id": payload.get("doctor_id") or (user_email if role == "doctor" else None),
                    "doctor_name": payload.get("doctor_name") or "Primary Care Worker",
                    "follow_up_type": tp,
                    "title": payload.get("title") or "Offline Created Follow-Up",
                    "description": payload.get("description") or payload.get("notes") or "",
                    "purpose": payload.get("purpose") or payload.get("title") or "Routine follow-up",
                    "doctor_instructions": payload.get("doctor_instructions") or "",
                    "doctor_notes": payload.get("notes") or "",
                    "due_date": due_date,
                    "due_time": payload.get("due_time") or "10:00",
                    "status": "CONFIRMED",
                    "priority": (payload.get("priority") or "NORMAL").upper(),
                    "local_id": item.local_id,
                    "created_at": item.created_at or now,
                    "updated_at": now,
                }
                res = await follow_ups_collection.insert_one(doc)
                server_id = new_fid

        # -------------------------------------------------------------
        # 4. Community / Home Visit Records
        # -------------------------------------------------------------
        elif record_type in ["visit_note", "community_visit", "home_visit"]:
            patient_name = payload.get("patient_name") or "Field Resident"
            target_patient = payload.get("patient_id") or user_email
            visit_id = f"VST-{uuid.uuid4().hex[:8].upper()}"
            visit_doc = {
                "follow_up_id": visit_id,
                "patient_id": target_patient,
                "patient_name": patient_name,
                "created_by": user_email,
                "created_by_role": role,
                "follow_up_type": "COMMUNITY_VISIT",
                "title": f"Community Visit: {patient_name}",
                "description": payload.get("observations") or payload.get("notes") or "Home visit conducted offline.",
                "purpose": "Field Community & Home Health Assessment",
                "doctor_instructions": payload.get("recommendations") or "",
                "doctor_notes": payload.get("notes") or "",
                "vitals": payload.get("vitals") or {},
                "due_date": payload.get("visit_date") or time.strftime("%Y-%m-%d"),
                "due_time": "12:00",
                "status": "COMPLETED",
                "priority": payload.get("priority", "NORMAL"),
                "completed_at": item.created_at or now,
                "local_id": item.local_id,
                "created_at": item.created_at or now,
                "updated_at": now,
            }
            await follow_ups_collection.insert_one(visit_doc)
            server_id = visit_id

        # -------------------------------------------------------------
        # 5. Health Case Reports (Disease Surveillance)
        # -------------------------------------------------------------
        elif record_type in ["health_case_report", "disease_report", "case_report"]:
            disease_name = payload.get("disease_name") or payload.get("disease") or "Unspecified Health Issue"
            lat = payload.get("latitude") or 19.0760
            lng = payload.get("longitude") or 72.8777
            report_doc = {
                "disease_name": disease_name,
                "description": payload.get("description") or payload.get("symptoms") or "Field health report",
                "severity": payload.get("severity") or "Moderate",
                "reported_by": user_email,
                "latitude": lat,
                "longitude": lng,
                "location": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                },
                "local_id": item.local_id,
                "status": "SUBMITTED",
                "timestamp": item.created_at or now,
                "created_at": item.created_at or now,
            }
            res = await disease_reports_collection.insert_one(report_doc)
            server_id = str(res.inserted_id)

        # -------------------------------------------------------------
        # 6. Referral Draft
        # -------------------------------------------------------------
        elif record_type in ["referral_draft", "referral"]:
            draft_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
            referral_doc = {
                "referral_id": draft_id,
                "user_email": user_email,
                "status": "DRAFT",
                "is_draft": True,
                "facility_name": payload.get("facility_name") or "Community Referral Center",
                "specialty": payload.get("specialty") or "General Medicine",
                "doctor_name": payload.get("doctor_name") or "Assigned Specialist",
                "reason": payload.get("reason") or payload.get("notes") or "Created offline during field consultation.",
                "urgency": payload.get("urgency") or "NORMAL",
                "notes": payload.get("notes") or "",
                "user_input": payload.get("user_input") or {},
                "triage_result": payload.get("triage_result") or {"summary": "Draft created offline"},
                "local_id": item.local_id,
                "timestamp": item.created_at or now,
                "created_at": item.created_at or now,
                "updated_at": now,
            }
            res = await referrals_history_collection.insert_one(referral_doc)
            server_id = draft_id

        # -------------------------------------------------------------
        # 7. Patient Profile / Emergency Profile Update
        # -------------------------------------------------------------
        elif record_type in ["profile_update", "profile", "emergency_profile"]:
            existing_prof = await profile_collection.find_one({"email": user_email})
            if existing_prof:
                server_updated = existing_prof.get("updated_at", 0)
                client_ts = item.client_updated_at or item.created_at or 0
                if server_updated > client_ts + 2.0:
                    conflict_detected = True
                    conflict_server_doc = clean_mongo_doc(existing_prof)

            if not conflict_detected:
                update_dict = {}
                allowed_keys = [
                    "name", "age", "dob", "mobile", "gender", "blood_group",
                    "allergies", "diseases", "medications", "emergency_contact",
                    "emergency_phone", "preferred_language"
                ]
                for k in allowed_keys:
                    if k in payload:
                        update_dict[k] = payload[k]

                update_dict["updated_at"] = now
                await profile_collection.update_one(
                    {"email": user_email},
                    {"$set": update_dict},
                    upsert=True
                )

                # Sync name/phone/preferred_language to users_collection
                user_updates = {}
                if "name" in update_dict:
                    user_updates["name"] = update_dict["name"]
                if "mobile" in update_dict:
                    user_updates["phone"] = update_dict["mobile"]
                if "preferred_language" in update_dict:
                    user_updates["preferred_language"] = update_dict["preferred_language"]

                if user_updates:
                    await users_collection.update_one(
                        {"email": user_email},
                        {"$set": user_updates}
                    )
                server_id = user_email

        else:
            raise ValueError(f"Unknown record_type: '{record_type}'")

        # -------------------------------------------------------------
        # Conflict Handling or Success Log
        # -------------------------------------------------------------
        if conflict_detected:
            await offline_sync_log_collection.update_one(
                {"local_id": item.local_id},
                {
                    "$set": {
                        "local_id": item.local_id,
                        "user_id": user_email,
                        "record_type": item.record_type,
                        "sync_status": "CONFLICT",
                        "server_data": conflict_server_doc,
                        "client_data": payload,
                        "error_message": "Server document was updated after offline snapshot.",
                        "synced_at": now,
                    }
                },
                upsert=True,
            )
            return {
                "local_id": item.local_id,
                "status": "CONFLICT",
                "record_type": item.record_type,
                "server_data": conflict_server_doc,
                "client_data": payload,
                "message": "Conflict detected: Server has newer changes than offline record.",
            }

        # Successful sync logged to offline_sync_log_collection
        await offline_sync_log_collection.update_one(
            {"local_id": item.local_id},
            {
                "$set": {
                    "local_id": item.local_id,
                    "user_id": user_email,
                    "record_type": item.record_type,
                    "server_id": str(server_id),
                    "sync_status": "SYNCED",
                    "payload": payload,
                    "error_message": None,
                    "synced_at": now,
                    "created_at": item.created_at or now,
                }
            },
            upsert=True,
        )

        return {
            "local_id": item.local_id,
            "status": "SYNCED",
            "server_id": str(server_id),
            "record_type": item.record_type,
            "message": "Successfully synchronized to server MongoDB.",
        }

    except Exception as e:
        err_msg = str(e)
        await offline_sync_log_collection.update_one(
            {"local_id": item.local_id},
            {
                "$set": {
                    "local_id": item.local_id,
                    "user_id": user_email,
                    "record_type": item.record_type,
                    "sync_status": "FAILED",
                    "payload": payload,
                    "error_message": err_msg,
                    "synced_at": now,
                }
            },
            upsert=True,
        )
        return {
            "local_id": item.local_id,
            "status": "FAILED",
            "record_type": item.record_type,
            "error_message": err_msg,
            "message": f"Sync failed: {err_msg}",
        }


@router.post("/sync")
async def sync_offline_records(
    request: Union[BatchSyncRequest, SyncItem],
    current_user: dict = Depends(get_current_user),
):
    """
    Unified Offline Sync Endpoint.
    Validates authentication/RBAC, checks idempotency via local_id,
    detects conflicts, and safely updates the canonical MongoDB collections.
    """
    if isinstance(request, BatchSyncRequest):
        results = []
        for itm in request.items:
            res = await process_single_sync_item(itm, current_user)
            results.append(res)
        return {"total": len(results), "results": results}
    else:
        # Single sync item
        res = await process_single_sync_item(request, current_user)
        return res


@router.get("/history")
async def get_sync_history(
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve history of synced/conflicted items for the current authenticated user."""
    user_email = current_user.get("sub", "")
    cursor = offline_sync_log_collection.find({"user_id": user_email}).sort("synced_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        items.append(clean_mongo_doc(doc))
    return {"items": items, "count": len(items)}


@router.post("/resolve-conflict")
async def resolve_conflict(
    request: ConflictResolveRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Manually resolve a sync conflict:
    - USE_CLIENT: force overwrite server record with client payload
    - USE_SERVER: discard client pending changes and mark resolved
    """
    user_email = current_user.get("sub", "")
    sync_entry = await offline_sync_log_collection.find_one({"local_id": request.local_id, "user_id": user_email})
    if not sync_entry:
        raise HTTPException(status_code=404, detail="Conflict record not found.")

    if request.resolution == "USE_SERVER":
        await offline_sync_log_collection.update_one(
            {"local_id": request.local_id},
            {"$set": {"sync_status": "RESOLVED_SERVER", "resolved_at": time.time()}}
        )
        return {"message": "Conflict resolved: server version kept.", "status": "RESOLVED_SERVER"}

    elif request.resolution == "USE_CLIENT":
        # Force re-process client payload bypassing conflict check
        payload = sync_entry.get("client_data") or sync_entry.get("payload") or {}
        record_type = sync_entry.get("record_type", "")
        item = SyncItem(
            local_id=f"{request.local_id}_resolved",
            record_type=record_type,
            payload=payload,
            created_at=time.time(),
            client_updated_at=time.time() + 999999,  # force client wins
        )
        res = await process_single_sync_item(item, current_user)
        await offline_sync_log_collection.update_one(
            {"local_id": request.local_id},
            {"$set": {"sync_status": "RESOLVED_CLIENT", "resolved_at": time.time()}}
        )
        return {"message": "Conflict resolved: client version applied to server.", "status": "RESOLVED_CLIENT", "result": res}

    raise HTTPException(status_code=400, detail="Invalid resolution. Must be 'USE_CLIENT' or 'USE_SERVER'.")
