from fastapi import FastAPI, APIRouter, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
import sys
import uuid
import time

sys.path.append(os.path.dirname(__file__))
from config import get_settings
from models import *
from auth import hash_password, verify_password, create_access_token, get_current_user
from cerebras_service import CerebrasSymptomAnalyzer

settings = get_settings()

client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]

app = FastAPI(title="AyuMitraAI API", version="1.0.0")
api_router = APIRouter(prefix="/api")

cerebras_analyzer = CerebrasSymptomAnalyzer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@api_router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "user_id": str(uuid.uuid4()),
        "email": user.email,
        "password": hash_password(user.password),
        "full_name": user.full_name,
        "role": user.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_doc["user_id"], "email": user.email, "role": user.role})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            created_at=datetime.fromisoformat(user_doc["created_at"])
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["user_id"], "email": user["email"], "role": user["role"]})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            created_at=datetime.fromisoformat(user["created_at"])
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"user_id": current_user["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@api_router.post("/connect-with-doctor")
async def connect_with_doctor(request: SymptomAnalysisRequest, current_user: dict = Depends(get_current_user)):
    """Connect patient with available doctors based on symptoms"""
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    try:
        # Get patient info
        patient = await db.users.find_one({"user_id": current_user["sub"]})
        
        # Analyze symptoms to get specialty
        analysis = await cerebras_analyzer.analyze_symptoms(
            request.symptom_description,
            request.patient_age
        )
        
        urgency = UrgencyLevel(
            level=analysis["urgency_level"],
            score=analysis["urgency_score"],
            justification=analysis["urgency_justification"]
        )
        
        primary_specialty = SpecialtyRecommendation(
            specialty=analysis["primary_specialty"],
            confidence=analysis["primary_confidence"],
            reasons=analysis["primary_reasons"]
        )
        
        # Find matching doctors (not just facilities)
        matching_doctors = await find_matching_doctors(
            analysis["primary_specialty"],
            urgency.level
        )
        
        # Create patient request for each matching doctor
        patient_request_doc = {
            "request_id": request_id,
            "patient_id": current_user["sub"],
            "patient_name": patient.get("full_name", "Patient"),
            "patient_age": request.patient_age,
            "symptoms": request.symptom_description,
            "urgency_level": urgency.level,
            "primary_specialty": analysis["primary_specialty"],
            "requested_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending",
            "matched_doctors": [doc["doctor_id"] for doc in matching_doctors],
            "assigned_doctor_id": None
        }
        
        await db.patient_requests.insert_one(patient_request_doc)
        
        # Notify matching doctors
        for doctor in matching_doctors:
            await db.doctor_notifications.insert_one({
                "notification_id": str(uuid.uuid4()),
                "doctor_id": doctor["doctor_id"],
                "patient_request_id": request_id,
                "patient_name": patient.get("full_name", "Patient"),
                "symptoms": request.symptom_description,
                "urgency_level": urgency.level,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "read": False
            })
        
        return {
            "request_id": request_id,
            "status": "pending",
            "urgency_level": urgency.level,
            "primary_specialty": analysis["primary_specialty"],
            "matching_doctors": [
                {
                    "doctor_id": doc["doctor_id"],
                    "name": doc["full_name"],
                    "specialization": doc["specialization"],
                    "experience_years": doc["experience_years"],
                    "facility_name": doc.get("facility_name"),
                    "is_online": doc.get("availability", {}).get("is_online", False)
                }
                for doc in matching_doctors
            ],
            "message": f"Found {len(matching_doctors)} available doctors. Waiting for response...",
            "processing_time_ms": (time.time() - start_time) * 1000
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@api_router.get("/patient/request-status/{request_id}")
async def get_request_status(request_id: str, current_user: dict = Depends(get_current_user)):
    """Get status of patient's doctor connection request"""
    request_doc = await db.patient_requests.find_one(
        {"request_id": request_id, "patient_id": current_user["sub"]},
        {"_id": 0}
    )
    
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    assigned_doctor = None
    if request_doc.get("assigned_doctor_id"):
        doctor = await db.doctors.find_one(
            {"doctor_id": request_doc["assigned_doctor_id"]},
            {"_id": 0}
        )
        if doctor:
            assigned_doctor = {
                "doctor_id": doctor["doctor_id"],
                "name": doctor["full_name"],
                "specialization": doctor["specialization"],
                "phone": doctor.get("phone"),
                "facility_name": doctor.get("facility_name")
            }
    
    return {
        "request_id": request_id,
        "status": request_doc.get("status"),
        "urgency_level": request_doc.get("urgency_level"),
        "symptoms": request_doc.get("symptoms"),
        "assigned_doctor": assigned_doctor,
        "matching_doctors_count": len(request_doc.get("matched_doctors", [])),
        "requested_at": request_doc.get("requested_at")
    }

@api_router.post("/analyze-symptoms", response_model=SymptomAnalysisResponse)
async def analyze_symptoms(request: SymptomAnalysisRequest, current_user: dict = Depends(get_current_user)):
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    try:
        analysis = await cerebras_analyzer.analyze_symptoms(
            request.symptom_description,
            request.patient_age
        )
        
        urgency = UrgencyLevel(
            level=analysis["urgency_level"],
            score=analysis["urgency_score"],
            justification=analysis["urgency_justification"]
        )
        
        primary_specialty = SpecialtyRecommendation(
            specialty=analysis["primary_specialty"],
            confidence=analysis["primary_confidence"],
            reasons=analysis["primary_reasons"]
        )
        
        alternative_specialties = [
            SpecialtyRecommendation(**alt) for alt in analysis.get("alternative_specialties", [])
        ]
        
        recommended_facilities = await find_matching_facilities(
            analysis["primary_specialty"],
            urgency.level,
            request.patient_location
        )
        
        recommended_actions = analysis["recommended_actions"]
        if analysis.get("critical_warnings"):
            recommended_actions = [f"⚠️ {w}" for w in analysis["critical_warnings"]] + recommended_actions
        
        routing_decision = RoutingDecision(
            urgency=urgency,
            primary_specialty=primary_specialty,
            alternative_specialties=alternative_specialties,
            recommended_facilities=recommended_facilities,
            recommended_actions=recommended_actions
        )
        
        analysis_doc = {
            "request_id": request_id,
            "user_id": current_user["sub"],
            "symptom_description": request.symptom_description,
            "patient_age": request.patient_age,
            "routing_decision": routing_decision.model_dump(),
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        await db.symptom_analyses.insert_one(analysis_doc)
        
        return SymptomAnalysisResponse(
            request_id=request_id,
            routing_decision=routing_decision,
            analysis_timestamp=datetime.now(timezone.utc),
            processing_time_ms=(time.time() - start_time) * 1000
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

async def find_matching_doctors(specialty: str, urgency: str) -> list:
    """Find online doctors matching the specialty"""
    doctors = []
    
    # Map common symptoms to medical specialties
    specialty_keywords = {
        "neurosurgery": ["brain", "head", "neurological", "seizure", "stroke", "concussion", "headache", "migraine", "dizziness", "vertigo", "memory", "cognitive", "neurosurgery", "neurosurgeon", "neural", "neuro", "skull", "spinal cord", "tumor", "aneurysm"],
        "neurology": ["brain", "head", "neurological", "seizure", "stroke", "concussion", "headache", "migraine", "dizziness", "vertigo", "memory", "cognitive", "neurology", "neurologist", "neural", "neuro", "nerve", "paralysis"],
        "cardiology": ["heart", "chest", "cardiac", "arrhythmia", "blood pressure", "hypertension", "palpitation", "angina", "cardiology", "cardiologist"],
        "orthopedics": ["bone", "fracture", "joint", "spine", "back", "knee", "shoulder", "arthritis", "ligament", "orthopedic", "orthopedics"],
        "gastroenterology": ["stomach", "digestive", "liver", "intestine", "ulcer", "acid reflux", "diarrhea", "constipation", "nausea", "gastro", "gastrointestinal"],
        "pulmonology": ["lung", "respiratory", "asthma", "cough", "breathing", "pneumonia", "bronchitis", "shortness of breath", "pulmonary"],
        "dermatology": ["skin", "rash", "acne", "eczema", "psoriasis", "allergy", "itching", "dermatology", "dermatologist"],
        "ophthalmology": ["eye", "vision", "sight", "blindness", "cataract", "glaucoma", "myopia", "ophthalmology", "ophthalmologist"],
        "general medicine": ["fever", "cold", "flu", "infection", "general", "checkup", "consultation", "wellness"]
    }
    
    # Find matching specialties based on keywords
    matched_specialties = set()
    specialty_lower = specialty.lower()
    
    # First try exact keyword matching
    for spec, keywords in specialty_keywords.items():
        for keyword in keywords:
            if keyword in specialty_lower:
                matched_specialties.add(spec)
                break
    
    # If no match found, add the specialty as-is for flexible matching
    if not matched_specialties:
        matched_specialties.add(specialty.lower())
    
    # Find online doctors with matching specialization
    all_doctors = await db.doctors.find({}, {"_id": 0}).to_list(100)
    
    for doctor in all_doctors:
        # Check if doctor is online
        if not doctor.get("availability", {}).get("is_online", False):
            continue
        
        doctor_spec = doctor.get("specialization", "").lower()
        
        # Check if any matched specialty is in the doctor's specialization
        for matched_spec in matched_specialties:
            # Flexible matching: check if specialty keywords match
            if matched_spec in doctor_spec or doctor_spec in matched_spec:
                doctors.append(doctor)
                break
            
            # Also check for partial matches (e.g., "neurosurgery" matches "neurosurgeon")
            if matched_spec.replace("y", "") in doctor_spec or doctor_spec.replace("y", "") in matched_spec:
                doctors.append(doctor)
                break
    
    return doctors[:10]  # Return top 10 matching doctors

async def find_matching_facilities(specialty: str, urgency: str, location: dict = None) -> List[FacilityMatch]:
    facilities = []
    
    # Map common symptoms to medical specialties
    specialty_keywords = {
        "neurosurgery": ["brain", "head", "neurological", "seizure", "stroke", "concussion", "headache", "migraine", "dizziness", "vertigo", "memory", "cognitive", "neurosurgery", "neurosurgeon", "neural", "neuro", "skull", "spinal cord", "tumor", "aneurysm"],
        "neurology": ["brain", "head", "neurological", "seizure", "stroke", "concussion", "headache", "migraine", "dizziness", "vertigo", "memory", "cognitive", "neurology", "neurologist", "neural", "neuro", "nerve", "paralysis"],
        "cardiology": ["heart", "chest", "cardiac", "arrhythmia", "blood pressure", "hypertension", "palpitation", "angina", "cardiology", "cardiologist"],
        "orthopedics": ["bone", "fracture", "joint", "spine", "back", "knee", "shoulder", "arthritis", "ligament", "orthopedic", "orthopedics"],
        "gastroenterology": ["stomach", "digestive", "liver", "intestine", "ulcer", "acid reflux", "diarrhea", "constipation", "nausea", "gastro", "gastrointestinal"],
        "pulmonology": ["lung", "respiratory", "asthma", "cough", "breathing", "pneumonia", "bronchitis", "shortness of breath", "pulmonary"],
        "dermatology": ["skin", "rash", "acne", "eczema", "psoriasis", "allergy", "itching", "dermatology", "dermatologist"],
        "ophthalmology": ["eye", "vision", "sight", "blindness", "cataract", "glaucoma", "myopia", "ophthalmology", "ophthalmologist"],
        "general medicine": ["fever", "cold", "flu", "infection", "general", "checkup", "consultation", "wellness"]
    }
    
    # Find matching specialties based on keywords
    matched_specialties = set()
    specialty_lower = specialty.lower()
    
    for spec, keywords in specialty_keywords.items():
        for keyword in keywords:
            if keyword in specialty_lower:
                matched_specialties.add(spec)
                break
    
    # If no specific match, use the provided specialty
    if not matched_specialties:
        matched_specialties.add(specialty.lower())
    
    if urgency == "critical":
        hospitals = await db.hospitals.find(
            {"has_emergency_dept": True},
            {"_id": 0}
        ).limit(5).to_list(5)
        
        for h in hospitals:
            facilities.append(FacilityMatch(
                facility_id=h["hospital_id"],
                facility_name=h["hospital_name"],
                facility_type="hospital",
                distance_km=None,
                availability="Emergency services available 24/7",
                emergency_capable=True,
                contact=h.get("contact_phone"),
                location=h.get("location")
            ))
    else:
        # Search clinics with better matching
        clinics = await db.clinics.find({}, {"_id": 0}).to_list(100)
        
        for c in clinics:
            doctor_spec = c.get("doctor", {}).get("specialization", "").lower()
            # Check if any matched specialty is in the doctor's specialization
            for matched_spec in matched_specialties:
                if matched_spec in doctor_spec or doctor_spec in matched_spec:
                    facilities.append(FacilityMatch(
                        facility_id=c["clinic_id"],
                        facility_name=c["clinic_name"],
                        facility_type="clinic",
                        doctor_name=c["doctor"]["name"],
                        doctor_specialization=c["doctor"]["specialization"],
                        availability=c["doctor"]["availability_hours"],
                        emergency_capable=c.get("accepts_emergencies", False),
                        contact=c.get("contact_phone"),
                        location=c.get("location")
                    ))
                    break
        
        # Also search hospitals for specialists
        hospitals = await db.hospitals.find({}, {"_id": 0}).to_list(100)
        
        for h in hospitals:
            hospital_services = [s.lower() for s in h.get("services", [])]
            hospital_doctors = h.get("doctors", [])
            
            # Check if hospital has matching services or doctors
            has_match = False
            for matched_spec in matched_specialties:
                for service in hospital_services:
                    if matched_spec in service or service in matched_spec:
                        has_match = True
                        break
                if has_match:
                    break
                
                # Check doctor specializations
                for doctor in hospital_doctors:
                    doc_spec = doctor.get("specialization", "").lower()
                    if matched_spec in doc_spec or doc_spec in matched_spec:
                        has_match = True
                        break
                if has_match:
                    break
            
            if has_match:
                facilities.append(FacilityMatch(
                    facility_id=h["hospital_id"],
                    facility_name=h["hospital_name"],
                    facility_type="hospital",
                    availability="Multiple specialists available",
                    emergency_capable=h.get("has_emergency_dept", False),
                    contact=h.get("contact_phone"),
                    location=h.get("location")
                ))
    
    return facilities[:5]

@api_router.post("/clinics/register", response_model=ClinicResponse, status_code=status.HTTP_201_CREATED)
async def register_clinic(clinic: ClinicRegistration, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["clinic_admin", "hospital_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can register facilities")
    
    clinic_doc = clinic.model_dump()
    clinic_doc["clinic_id"] = str(uuid.uuid4())
    clinic_doc["owner_id"] = current_user["sub"],
    clinic_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.clinics.insert_one(clinic_doc)
    
    return ClinicResponse(
        clinic_id=clinic_doc["clinic_id"],
        clinic_name=clinic.clinic_name,
        location=clinic.location,
        doctor=clinic.doctor,
        accepts_emergencies=clinic.accepts_emergencies,
        created_at=datetime.fromisoformat(clinic_doc["created_at"])
    )

@api_router.post("/hospitals/register", response_model=HospitalResponse, status_code=status.HTTP_201_CREATED)
async def register_hospital(hospital: HospitalRegistration, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "hospital_admin":
        raise HTTPException(status_code=403, detail="Only hospital admins can register hospitals")
    
    hospital_doc = hospital.model_dump()
    hospital_doc["hospital_id"] = str(uuid.uuid4())
    hospital_doc["owner_id"] = current_user["sub"]
    hospital_doc["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.hospitals.insert_one(hospital_doc)
    
    return HospitalResponse(
        hospital_id=hospital_doc["hospital_id"],
        hospital_name=hospital.hospital_name,
        hospital_type=hospital.hospital_type,
        location=hospital.location,
        doctors_count=len(hospital.doctors),
        has_emergency_dept=hospital.has_emergency_dept,
        services=hospital.services,
        created_at=datetime.fromisoformat(hospital_doc["created_at"])
    )

@api_router.get("/clinics")
async def get_clinics():
    clinics = await db.clinics.find({}, {"_id": 0}).to_list(100)
    return clinics

@api_router.get("/hospitals")
async def get_hospitals():
    hospitals = await db.hospitals.find({}, {"_id": 0}).to_list(100)
    return hospitals

@api_router.get("/history")
async def get_user_history(current_user: dict = Depends(get_current_user)):
    history = await db.symptom_analyses.find(
        {"user_id": current_user["sub"]},
        {"_id": 0}
    ).sort("analysis_timestamp", -1).limit(20).to_list(20)
    return history

@api_router.post("/auth/register-doctor", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_doctor(doctor: DoctorRegistration):
    existing_user = await db.users.find_one({"email": doctor.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    facility = await db.clinics.find_one({"clinic_id": doctor.facility_id})
    facility_type = "clinic"
    facility_name = facility.get("clinic_name") if facility else None
    
    if not facility:
        facility = await db.hospitals.find_one({"hospital_id": doctor.facility_id})
        facility_type = "hospital"
        facility_name = facility.get("hospital_name") if facility else None
    
    if not facility:
        raise HTTPException(status_code=404, detail="Invalid facility ID. Please check with your clinic/hospital administrator.")
    
    doctor_id = str(uuid.uuid4())
    user_doc = {
        "user_id": doctor_id,
        "email": doctor.email,
        "password": hash_password(doctor.password),
        "full_name": doctor.full_name,
        "role": "doctor",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    doctor_profile = {
        "doctor_id": doctor_id,
        "full_name": doctor.full_name,
        "email": doctor.email,
        "specialization": doctor.specialization,
        "experience_years": doctor.experience_years,
        "license_number": doctor.license_number,
        "phone": doctor.phone,
        "facility_id": doctor.facility_id,
        "facility_name": facility_name,
        "facility_type": facility_type,
        "availability": {
            "is_online": False,
            "time_slots": []
        },
        "patients_treated": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    await db.doctors.insert_one(doctor_profile)
    
    token = create_access_token({"sub": doctor_id, "email": doctor.email, "role": "doctor"})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            email=doctor.email,
            full_name=doctor.full_name,
            role="doctor",
            created_at=datetime.fromisoformat(user_doc["created_at"])
        )
    )

@api_router.get("/doctor/profile", response_model=DoctorProfile)
async def get_doctor_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")
    
    doctor = await db.doctors.find_one({"doctor_id": current_user["sub"]}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    
    return DoctorProfile(**doctor)

@api_router.put("/doctor/availability")
async def update_doctor_availability(availability: UpdateDoctorAvailability, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can update availability")
    
    update_data = {}
    if availability.is_online is not None:
        update_data["availability.is_online"] = availability.is_online
    if availability.time_slots is not None:
        update_data["availability.time_slots"] = [slot.model_dump() for slot in availability.time_slots]
    
    result = await db.doctors.update_one(
        {"doctor_id": current_user["sub"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    return {"message": "Availability updated successfully"}

@api_router.get("/doctor/requests")
async def get_doctor_requests(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")
    
    # Find requests where this doctor is in the matched_doctors array
    requests = await db.patient_requests.find(
        {"matched_doctors": current_user["sub"]},
        {"_id": 0}
    ).sort("requested_at", -1).to_list(100)
    
    return requests

@api_router.get("/doctor/stats", response_model=DoctorStats)
async def get_doctor_stats(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")
    
    doctor = await db.doctors.find_one({"doctor_id": current_user["sub"]})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    total_requests = await db.patient_requests.count_documents({"matched_doctors": current_user["sub"]})
    pending_requests = await db.patient_requests.count_documents({"matched_doctors": current_user["sub"], "status": "pending"})
    
    return DoctorStats(
        total_requests=total_requests,
        pending_requests=pending_requests,
        patients_treated=doctor.get("patients_treated", 0),
        online_status=doctor.get("availability", {}).get("is_online", False)
    )

@api_router.post("/doctor/request/{request_id}/accept")
async def accept_patient_request(request_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can accept requests")
    
    # Verify doctor is in matched_doctors list
    request_doc = await db.patient_requests.find_one({"request_id": request_id})
    if not request_doc or current_user["sub"] not in request_doc.get("matched_doctors", []):
        raise HTTPException(status_code=404, detail="Request not found or not assigned to you")
    
    result = await db.patient_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted", "assigned_doctor_id": current_user["sub"]}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get doctor info
    doctor = await db.doctors.find_one({"doctor_id": current_user["sub"]})
    
    return {
        "message": "Request accepted",
        "request_id": request_id,
        "patient_id": request_doc.get("patient_id"),
        "doctor_name": doctor.get("full_name"),
        "doctor_phone": doctor.get("phone")
    }

@api_router.post("/doctor/request/{request_id}/complete")
async def complete_patient_request(request_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can complete requests")
    
    # Verify doctor is assigned to this request
    request_doc = await db.patient_requests.find_one({"request_id": request_id})
    if not request_doc or request_doc.get("assigned_doctor_id") != current_user["sub"]:
        raise HTTPException(status_code=404, detail="Request not found or not assigned to you")
    
    result = await db.patient_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "completed"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.doctors.update_one(
        {"doctor_id": current_user["sub"]},
        {"$inc": {"patients_treated": 1}}
    )
    
    return {"message": "Request completed"}

@api_router.get("/facilities/search")
async def search_facilities(query: str = ""):
    facilities = []
    
    clinics = await db.clinics.find(
        {"clinic_name": {"$regex": query, "$options": "i"}},
        {"_id": 0, "clinic_id": 1, "clinic_name": 1}
    ).limit(10).to_list(10)
    
    for clinic in clinics:
        facilities.append({
            "id": clinic["clinic_id"],
            "name": clinic["clinic_name"],
            "type": "clinic"
        })
    
    hospitals = await db.hospitals.find(
        {"hospital_name": {"$regex": query, "$options": "i"}},
        {"_id": 0, "hospital_id": 1, "hospital_name": 1}
    ).limit(10).to_list(10)
    
    for hospital in hospitals:
        facilities.append({
            "id": hospital["hospital_id"],
            "name": hospital["hospital_name"],
            "type": "hospital"
        })
    
    return facilities

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AyuMitraAI",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown():
    client.close()