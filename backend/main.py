from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# Add the current directory to sys.path to ensure absolute imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routes import auth, reports, claims, profile, innovation, chatbot, suggestions, diseases, dashboard, triage, referrals, telemedicine, emergency, hospitals, vaccinations, followups, medicines, diagnostics, health, offline_sync
from database import init_indexes
from routes.medicines import ensure_medicine_inventory_seeded
from routes.diagnostics import ensure_diagnostic_services_seeded

app = FastAPI(title="SwasthyaSetu AI API")

@app.on_event("startup")
async def startup_event():
    await init_indexes()
    await ensure_medicine_inventory_seeded()
    await ensure_diagnostic_services_seeded()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(offline_sync.router, prefix="/api/offline", tags=["offline-sync"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(claims.router, prefix="/api/claims", tags=["claims"])
app.include_router(innovation.router, prefix="/api/problems", tags=["innovation"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["chatbot"])
app.include_router(suggestions.router, prefix="/api/ai-suggestions", tags=["suggestions"])
app.include_router(diseases.router, prefix="/api/diseases", tags=["diseases"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(triage.router, prefix="/api/triage", tags=["triage"])
app.include_router(referrals.router, prefix="/api/referrals", tags=["referrals"])
app.include_router(telemedicine.router, prefix="/api/telemedicine", tags=["telemedicine"])
app.include_router(emergency.router, prefix="/api/emergency", tags=["emergency"])
app.include_router(hospitals.router, prefix="/api/hospitals", tags=["hospitals"])
app.include_router(vaccinations.router, prefix="/api/vaccinations", tags=["vaccinations"])
app.include_router(followups.router, prefix="/api/follow-ups", tags=["followups"])
app.include_router(medicines.router, prefix="/api/medicines", tags=["medicines"])
app.include_router(diagnostics.router, prefix="/api/diagnostics", tags=["diagnostics"])





@app.get("/")
async def root():
    return {"message": "SwasthyaSetu AI API is running"}
