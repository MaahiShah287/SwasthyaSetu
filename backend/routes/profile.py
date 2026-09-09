from fastapi import APIRouter, Depends, HTTPException
from database import profile_collection
from utils.jwt_handler import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class ProfileUpdate(BaseModel):
    name: str
    age: int
    dob: str
    mobile: str
    gender: str
    blood_group: str
    allergies: Optional[str] = ""
    diseases: Optional[str] = ""
    medications: Optional[str] = ""
    emergency_contact: str
    preferred_language: Optional[str] = "mr"

class LanguageUpdate(BaseModel):
    preferred_language: str

@router.get("/")
async def get_profile(current_user: dict = Depends(get_current_user)):
    from database import users_collection
    profile = await profile_collection.find_one({"email": current_user["sub"]})
    if not profile:
        user = await users_collection.find_one({"email": current_user["sub"]})
        pref_lang = user.get("preferred_language", "mr") if user else "mr"
        return {"email": current_user["sub"], "preferred_language": pref_lang}
    profile["_id"] = str(profile["_id"])
    if "preferred_language" not in profile or not profile["preferred_language"]:
        user = await users_collection.find_one({"email": current_user["sub"]})
        profile["preferred_language"] = (user and user.get("preferred_language")) or "mr"
    return profile

@router.put("/")
async def update_profile(profile_data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    from database import users_collection
    data = profile_data.dict()
    await profile_collection.update_one(
        {"email": current_user["sub"]},
        {"$set": data},
        upsert=True
    )
    if profile_data.preferred_language:
        await users_collection.update_one(
            {"email": current_user["sub"]},
            {"$set": {"preferred_language": profile_data.preferred_language}}
        )
    return {"message": "Profile updated successfully", "preferred_language": profile_data.preferred_language}

@router.patch("/language")
@router.put("/language")
async def update_preferred_language(data: LanguageUpdate, current_user: dict = Depends(get_current_user)):
    from database import users_collection
    lang = data.preferred_language.lower()
    if lang not in ["mr", "hi", "en"]:
        lang = "mr"
    
    await profile_collection.update_one(
        {"email": current_user["sub"]},
        {"$set": {"preferred_language": lang}},
        upsert=True
    )
    await users_collection.update_one(
        {"email": current_user["sub"]},
        {"$set": {"preferred_language": lang}}
    )
    return {"message": "Preferred language updated successfully", "preferred_language": lang}

