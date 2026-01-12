# AyuMitraAI

AI-powered medical symptom analysis and intelligent doctor routing system.

## Overview

AyuMitraAI connects patients with the right healthcare providers using AI-driven symptom analysis. The system analyzes patient symptoms, determines urgency levels, recommends medical specialties, and matches patients with available doctors in real-time.

## Tech Stack

- **Backend**: FastAPI (Python) with MongoDB
- **Frontend**: React with Tailwind CSS
- **AI**: Cerebras LLM for symptom analysis
- **Database**: MongoDB Atlas

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install dnspython  # For MongoDB Atlas SRV connections

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and API keys

# Run server
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# Edit .env with backend URL (default: http://127.0.0.1:8000)

# Run development server
npm start
```

## Environment Variables

### Backend (.env)

```env
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/?appName=YourApp
DB_NAME=ayumitraai
JWT_SECRET=your-secret-key
CEREBRAS_API_KEY=your-cerebras-key
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Frontend (.env)

```env
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
```

## Features

- **Patient Registration & Login**: Secure authentication with JWT
- **Doctor Registration**: Doctors register with clinic/hospital facility IDs
- **Clinic/Hospital Admin Registration**: Admins get unique facility IDs for doctor onboarding
- **AI Symptom Analysis**: Cerebras-powered analysis with urgency scoring
- **Doctor Matching**: Real-time matching based on specialty and availability
- **Doctor Dashboard**: Manage availability, view patient requests, accept/complete consultations

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register patient |
| `/api/auth/login` | POST | Login |
| `/api/auth/register-doctor` | POST | Register doctor |
| `/api/auth/register-clinic` | POST | Register clinic admin |
| `/api/auth/register-hospital` | POST | Register hospital admin |
| `/api/analyze-symptoms` | POST | AI symptom analysis |
| `/api/connect-with-doctor` | POST | Connect patient with doctors |
| `/api/doctor/availability` | PUT | Update doctor availability |
| `/api/doctor/requests` | GET | Get patient requests |

## Project Structure

```
AyuMitraAI/
├── backend/
│   ├── server.py          # FastAPI application
│   ├── models.py          # Pydantic models
│   ├── auth.py            # JWT authentication
│   ├── config.py          # Configuration
│   ├── cerebras_service.py # AI symptom analysis
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/         # React pages
│   │   ├── components/    # UI components
│   │   └── utils/         # API client, auth helpers
│   └── package.json
└── README.md
```

## License

MIT
