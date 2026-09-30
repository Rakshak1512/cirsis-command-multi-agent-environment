# CRISIS COMMAND — Multi-Agent Emergency Response & Resource Coordination System
**GATEWAYS 2026 — Public Safety & Emergency Response**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.x-61DAFB.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900.svg?logo=leaflet)](https://leafletjs.com/)
[![ECharts](https://img.shields.io/badge/Apache_ECharts-5.x-AA344D.svg?logo=apacheecharts)](https://echarts.apache.org/)

---

## 🌟 Executive Summary

**Crisis Command** is a next-generation, autonomous Emergency Operations Center (EOC) platform built for municipal public safety, fire departments, emergency medical services, and trauma centers.

Traditional 911/112 dispatch pipelines suffer from critical human dispatch latency: operators manually triage, call around for station availability, calculate route delays, and delay decisions pending multiple confirmations.

**Crisis Command eliminates human dispatch bottlenecks entirely:**
1. **Intake & Assessment:** Ingests citizen reports, CCTV streams, and IoT sensors with source-confidence scoring.
2. **AI Multi-Agent Reasoning:** Specialized LangGraph agents assess structural fire severity, vehicle collision kinetic entrapment, burn hazard, and casualty estimates.
3. **Deterministic Optimization:** Bypasses LLM hallucinations by calculating exact Haversine distances, emergency siren speed profiles, vehicle equipment eligibility, and hospital ICU bed capacity deterministically.
4. **Autonomous Plan Execution:** Synthesizes and **automatically executes** **Plan V1** in milliseconds with **ZERO confirmation dialogs** blocking the response.
5. **Self-Healing Dynamic Replanning:** When an ambulance breaks down, fire spreads, or high-priority casualties erupt, the system autonomously triggers **Plan V2 / Plan V3** with zero downtime, notifies responders, draws real-time routes, updates the map, and posts transparent "Why plan changed" logs.
6. **Commander Executive Oversight:** Human-on-the-loop executive control allows instantaneous manual overrides (reassign units, escalate severity, trigger re-routes) that execute immediately and record to an immutable audit trail.

---

## 🛡️ Critical Design Mandate: No Approval Blocking

Crisis Command enforces a strict **Zero-Approval Execution Policy**:
- **DO NOT ASK:** `"Are you sure?"`, `"Approve?"`, `"Confirm?"`, `"Submit?"`, `"Do you want to proceed?"`
- **INSTEAD:**
  $$\text{AI Recommendation} \longrightarrow \text{Deterministic Validation} \longrightarrow \text{Execute Automatically} \longrightarrow \text{Notify Command} \longrightarrow \text{Manual Override Available}$$
- Normal operations execute instantaneously:
  - Reporting an incident $\rightarrow$ Immediately submitted and dispatched.
  - Creating a response plan $\rightarrow$ Automatically activated as Plan V1.
  - Resource breakdown or fire spread $\rightarrow$ Automatically replanned as Plan V2.
  - Field responders $\rightarrow$ One-click status updates (`EN ROUTE`, `ON SCENE`, `RESOLVED`).

---

## 🏗️ Multi-Agent Architecture

```
                       [ Incoming Emergency Event ]
                                    │
                                    ▼
                     [ Incident Assessment Agent ]
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
    [ Fire Specialist Agent ]                 [ Accident Specialist Agent ]
    (Structure, Foam, Hazmat)                 (Jaws of Life, Trauma Care)
              └─────────────────────┬─────────────────────┘
                                    ▼
                     [ Resource Allocation Agent ]
                      (Candidate Unit Discovery)
                                    │
                                    ▼
                   [ Deterministic Decision Engine ]
                  (Haversine Distance, Urban ETA,
                   Constraint & Capacity Checks)
                                    │
                                    ▼
                      [ Command Planning Agent ]
                    (Synthesizes Plan V1 Response)
                                    │
                                    ▼
                    ⚡ [ Autonomous Execution ] ⚡
                                    │
         ┌───────────────┬──────────┴───────────┬───────────────┐
         ▼               ▼                      ▼               ▼
   [ Dispatches ]   [ Live Map ]        [ Notifications ]   [ Audit Trail ]
   (Fire / Amb /    (Leaflet Polylines  (FCM / SMTP /       (Immutable
    Hospital)        & Radar Halos)      WebSockets)         SHA-256)
                                    │
                          [ Event Detection ]
                     (Ambulance Breakdown / Spread)
                                    │
                                    ▼
                       [ Replanning Manager ]
                     (Plan V1 ──▶ Plan V2 ──▶ V3)
```

---

## 🚀 Quickstart & Startup Commands

### Prerequisites
- **Node.js**: v18+ (tested on v24)
- **Python**: 3.11+
- **Git**

### 1. Backend Setup (FastAPI)
```powershell
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run automated test suite
$env:PYTHONPATH="."
pytest -v tests

# Start FastAPI server (Port 8000)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Backend API will be live at: `http://127.0.0.1:8000`  
Swagger API Docs: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup (React + Vite + TypeScript)
```powershell
# Navigate to frontend (in a separate terminal)
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```
Frontend Web Dashboard will be live at: `http://127.0.0.1:5173`

---

## 🔑 Pre-Seeded Demonstration Personas

All pre-seeded demo accounts share the password: `Password123!`

| Persona | Email | Role | Portal Route | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Chief Commander Marcus Vance** | `commander@crisiscommand.org` | `COMMANDER` | `/commander/dashboard` | Central EOC Tactical Command Center |
| **Capt. Elena Rostova** | `fire@crisiscommand.org` | `FIRE_TEAM` | `/fire-team/dashboard` | Station Alpha Field Cockpit |
| **Dr. Sarah Lin** | `hospital@crisiscommand.org` | `HOSPITAL` | `/hospital/dashboard` | Metro General Trauma Intake |
| **Alex Mercer** | `citizen@crisiscommand.org` | `CITIZEN` | `/citizen/dashboard` | Citizen GPS Emergency Reporting |
| **System Admin Sarah** | `admin@crisiscommand.org` | `ADMIN` | `/commander/dashboard` | Root Administrative Clearance |

*Note: The UI includes a persistent **"Quick Persona Switcher"** in the top navigation bar for seamless demonstration during hackathon presentation!*

---

## 🎮 Hackathon Interactive Demo Controls Bar

At the top of the interface is a persistent **Demo Controls Bar** with instant 1-click execution:

1. **🔥 SIMULATE FIRE**: Spawns an active 4th-floor structural fire incident with casualties; system autonomously triages, computes nearby engines and ambulances, and activates **Plan V1**.
2. **🚗 SIMULATE ACCIDENT**: Spawns a multi-vehicle highway crash with entrapment; assigns heavy hydraulic extricators and trauma bays.
3. **⚡ ESCALATE FIRE (V1 $\rightarrow$ V2)**: Simulates fire spreading across chemical barriers; system detects severity jump, recalculates optimal backup units, and **autonomously activates Plan V2** with "Why plan changed" logs.
4. **⚠️ AMBULANCE BREAKDOWN**: Simulates mechanical failure of Ambulance Unit 01 en route; system instantly detects failure, finds closest standby ALS unit, and activates **Plan V2** with zero downtime.
5. **🏥 RESTORE AMB 01**: Returns Ambulance 01 back to service.
6. **✅ RESOLVE ACTIVE**: Marks active incident resolved and releases units back to ready status.
7. **🔄 RESET DEMO**: Resets all incidents, resources, assignments, and audit logs back to pristine starting seed state.

---

## 📱 WhatsApp Alert Dispatch (Section 29)

Every incident features a **Share Crisis Alert** action that formats an official emergency broadcast:
```text
🚨 CRISIS COMMAND ALERT 🚨

📍 Incident: Structural Fire
⚠️ Severity: HIGH (CRITICAL)
📌 Location: Grand Mall Plaza, 4th Floor Commercial Wing
👥 People Affected: 6
🚒 Assigned Responders: Central Fire Station Alpha, Ambulance Unit 01
🏥 Designated Hospital: Metro Central General Hospital
🗺️ Live Map: https://www.openstreetmap.org/?mlat=12.9796&mlon=77.6026#map=16/12.9796/77.6026
🆔 Incident ID: INC-001

⚡ Automated Response & Logistics Dispatched by Crisis Command AI Platform
```
Includes instant deep-links to WhatsApp Web / WhatsApp Mobile with zero credential exposure.

---

## 🔒 Security & Environment Variables

Create `.env` inside `backend/`:
```ini
PROJECT_NAME="Crisis Command"
ENV="development"
PORT=8000
HOST="0.0.0.0"

JWT_SECRET="your_secure_jwt_secret_key_here"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Gemini AI API (Optional - Deterministic fallback active for offline/demo reliability)
GEMINI_API_KEY=""

# SMTP Email (Optional - Built-in simulated SMTP active for instant testing)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USERNAME=""
SMTP_PASSWORD=""
SMTP_FROM_EMAIL="noreply@crisiscommand.org"
SMTP_USE_TLS=true

# Firebase Admin Configuration (Optional - Environment Variables)
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""

FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:8000"
```

---

## 🧪 Test Suite Verification

Run the automated test suite:
```powershell
cd backend
$env:PYTHONPATH="."
pytest -v tests
```
Output:
```text
tests/test_core.py::test_health_and_root PASSED               [ 12%]
tests/test_core.py::test_haversine_and_eta PASSED             [ 25%]
tests/test_core.py::test_login_demo_commander PASSED          [ 37%]
tests/test_core.py::test_incident_creation_and_auto_plan_v1   [ 50%]
tests/test_core.py::test_dynamic_replanning_to_plan_v2 PASSED [ 62%]
tests/test_core.py::test_whatsapp_share_alert PASSED          [ 75%]
tests/test_core.py::test_commander_override PASSED            [ 87%]
tests/test_core.py::test_analytics_metrics PASSED             [100%]
======================== 8 passed in 1.01s ========================
```

---

## 🏆 GATEWAYS 2026 Submission Highlights
- **Real-Time WebSockets**: Instant updates across Commander, Responders, and Map without refreshing.
- **Dynamic Replanning Engine**: Self-healing response plans with Plan V1 $\rightarrow$ Plan V2 versioning and transparent decision explanations.
- **Mathematical Determinism**: Haversine distance, siren speed profiles, and capacity matrices ensure safety and prevent AI hallucinations.
- **Zero-Approval Execution**: Completely eliminates human bottleneck delays for time-critical emergency public safety.
