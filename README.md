# AyuMitraAI

AI-powered medical symptom analysis and intelligent doctor routing system. Connect patients with the right healthcare providers instantly.

## Overview

AyuMitraAI is a critical healthcare service that prioritizes patient access over authentication. Patients can immediately search for doctors and describe symptoms without signup friction. The system uses Google Gemini AI for symptom analysis, LangSmith for tracing, and Firecrawl for web-based doctor discovery.

**Core Philosophy**: "In critical services, serve first, authenticate later" - patients get instant access to search and find doctors, with authentication only required when connecting with a provider.

## Key Features

- **No-Auth Doctor Search**: Patients can search doctors immediately from the homepage
- **AI Symptom Analysis**: Google Gemini 2.0 Flash analyzes symptoms and determines urgency (critical/moderate/mild)
- **Hybrid Doctor Search**: Find both registered doctors and web-scraped doctors from multiple Indian platforms
- **Smart Routing**: AI recommends appropriate medical specialties based on symptoms
- **Real-time Doctor Matching**: Connect patients with available online doctors instantly
- **Web Doctor Integration**: Search across Practo, 1mg, Lybrate, JustDial, DoctorIndia
- **LangSmith Tracing**: Full observability of AI decisions and agent actions
- **Mobile Responsive**: Fully optimized for mobile and desktop

## Tech Stack

- **Backend**: FastAPI (Python 3.12) with async/await
- **Frontend**: React with Tailwind CSS
- **AI**: Google Gemini 2.0 Flash + LangChain + LangSmith
- **Web Scraping**: Firecrawl API
- **Database**: MongoDB Atlas
- **Package Manager**: uv (Python)

## Quick Start

### Prerequisites

- Python 3.12 (use `uv` for version management)
- Node.js 18+
- MongoDB Atlas account
- API Keys:
  - Google Gemini API
  - LangSmith API
  - Firecrawl API

### Backend Setup

```bash
cd backend

# Create virtual environment with Python 3.12
uv venv --python 3.12

# Activate (Windows)
.venv\Scripts\activate

# Activate (Mac/Linux)
source .venv/bin/activate

# Install dependencies
uv pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys and MongoDB URI

# Run server
uvicorn server:app --reload --host 0.0.0.0 --port 8000
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
# MongoDB
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/?appName=AyuMitraAI
DB_NAME=ayumitraai

# JWT
JWT_SECRET=your-secret-key-here

# Google Gemini
GOOGLE_API_KEY=your-google-api-key
GOOGLE_GEMINI_API_KEY=your-google-gemini-api-key

# LangSmith Tracing
LANGSMITH_API_KEY=your-langsmith-api-key
LANGSMITH_PROJECT=ayumitra-ai
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_TRACING=true

# Firecrawl Web Scraping
FIRECRAWL_API_KEY=your-firecrawl-api-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Frontend (.env)

```env
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register patient
- `POST /api/auth/login` - Login
- `POST /api/auth/register-doctor` - Register doctor
- `POST /api/auth/register-clinic` - Register clinic admin
- `POST /api/auth/register-hospital` - Register hospital admin

### Patient Services (No Auth Required)
- `POST /api/connect-with-doctor` - Connect with registered doctors
- `GET /api/patient/request-status/{request_id}` - Check connection status
- `GET /api/patient/history` - Get consultation history (optional auth)

### Doctor Search (No Auth Required)
- `POST /api/search/doctors/hybrid` - Search registered + web doctors
- `POST /api/search/doctors/registered` - Search registered doctors only
- `POST /api/search/doctors/web` - Search web-scraped doctors only
- `POST /api/connect/doctor/web` - Connect with web-scraped doctor

### Symptom Analysis (Auth Required)
- `POST /api/analyze-symptoms` - AI symptom analysis with routing

### Doctor Dashboard (Auth Required)
- `GET /api/doctor/profile` - Get doctor profile
- `PUT /api/doctor/availability` - Update availability status
- `GET /api/doctor/requests` - Get patient requests
- `GET /api/doctor/stats` - Get doctor statistics
- `POST /api/doctor/request/{request_id}/accept` - Accept patient request
- `POST /api/doctor/request/{request_id}/complete` - Complete consultation

## Project Structure

```
AyuMitraAI/
├── backend/
│   ├── server.py              # FastAPI application
│   ├── models.py              # Pydantic models
│   ├── auth.py                # JWT authentication
│   ├── config.py              # Configuration
│   ├── gemini_service.py      # Google Gemini AI service
│   ├── langchain_agents.py    # LangChain agents with LangSmith
│   ├── doctor_scraper.py      # Firecrawl web scraping
│   ├── requirements.txt       # Python dependencies
│   └── pyproject.toml         # uv configuration
├── frontend/
│   ├── src/
│   │   ├── pages/             # React pages
│   │   │   ├── LandingPage.js
│   │   │   ├── PatientDashboard.js
│   │   │   ├── DoctorDashboard.js
│   │   │   └── ...
│   │   ├── components/        # UI components
│   │   └── utils/             # API client, auth helpers
│   └── package.json
└── README.md
```

## Deployment

### Render.com Deployment

1. Push code to GitHub
2. Create new Web Service on Render
3. Set environment variables in Render dashboard
4. Deploy

**Important**: Ensure `langchain-google-genai>=4.2.1` in requirements.txt (not 0.1.0)

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Code Quality

```bash
# Backend linting
cd backend
flake8 .
black .

# Frontend linting
cd frontend
npm run lint
```

## Troubleshooting

### Deployment Error: "langchain-google-genai==0.1.0 not found"
- Update `requirements.txt` to use `langchain-google-genai>=4.2.1`
- The version 0.1.0 doesn't exist in PyPI

### Firecrawl Search Returns Empty
- Verify Firecrawl API key is valid
- Check that search query is properly formatted
- Ensure target websites are accessible

### LangSmith Tracing Not Working
- Verify `LANGSMITH_API_KEY` is set correctly
- Ensure `LANGSMITH_TRACING=true` in environment
- Check LangSmith project name matches `LANGSMITH_PROJECT`

## License

MIT
