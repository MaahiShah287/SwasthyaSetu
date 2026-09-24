# 🏥 SwasthyaSetu (स्वास्थ्य सेतु) - AI Healthcare Access Platform

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success?style=for-the-badge&logo=vercel)](https://swasthyasetu-blue.vercel.app/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)

**SwasthyaSetu** is an end-to-end, AI-powered healthcare intelligence platform designed to revolutionize healthcare delivery, clinical triage, medical document analysis, emergency hospital discovery, and community health tracking.

---

## 🌟 Key Features

* **🩺 Smart AI Symptom Triage**: Interactive multi-lingual AI symptom checker powered by Google Gemini AI.
* **📄 AI Medical Document Digitizer**: Automatic OCR extraction and structured diagnostic analysis of prescription images, lab reports, and medical insurance claims.
* **🏥 Real-Time Healthcare Discovery**: Geospatial locator for nearby hospitals, blood banks, oxygen centers, and specialty clinics.
* **🚑 Emergency & Bed Capacity Command**: Real-time hospital admin portal managing live general/ICU bed vacancies and rapid ambulance dispatch.
* **📹 Telemedicine & Digital Prescriptions**: Complete consultation scheduling with video link generation, follow-up tracking, and medicine inventory lookup.
* **📶 Offline-First Community Sync**: IndexedDB offline queuing designed for rural community health workers (ASHA/ANM) with automatic synchronization.

---

## 🏗️ Architecture Stack

* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Leaflet Maps, React Query.
* **Backend**: FastAPI (Python), Motor (Async MongoDB Driver), PyJWT Auth, Pydantic v2.
* **AI & Cloud Services**: Google Gemini AI API, Groq AI, Cloudinary OCR Storage, MongoDB Atlas.
* **Deployment**: Frontend hosted on **Vercel**, Backend hosted on **Render**.

---

## 🚀 Live Demo & Access

* **Live Frontend**: [https://swasthya-setu-eta.vercel.app](https://swasthya-setu-eta.vercel.app)

### Demo Role Access:
* **Patient Portal**: Register or login as a **Patient** to run AI triage, upload medical reports, and book appointments.
* **Doctor Portal**: Register as a **Doctor** to view patient queues, manage consultation slots, and write prescriptions.
* **Hospital Portal**: Register as a **Hospital Admin** to manage live bed capacity, departments, and ambulances.

---

## ⚙️ Local Development Setup

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📜 License
Developed under the Open Healthcare Initiative for accessible digital healthcare solutions.
