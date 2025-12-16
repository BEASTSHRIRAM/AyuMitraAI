from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: Literal["patient", "doctor", "clinic_admin", "hospital_admin"] = "patient"
    
class DoctorRegistration(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: Literal["doctor"] = "doctor"
    facility_id: str = Field(description="Unique clinic or hospital ID")
    specialization: str
    experience_years: int = Field(ge=0)
    license_number: str
    phone: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    email: str
    full_name: str
    role: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class SymptomAnalysisRequest(BaseModel):
    symptom_description: str = Field(min_length=10, max_length=2000)
    patient_age: Optional[int] = Field(None, ge=0, le=150)
    patient_location: Optional[dict] = None

class UrgencyLevel(BaseModel):
    level: Literal["critical", "moderate", "mild"]
    score: float = Field(ge=0.0, le=1.0)
    justification: str

class SpecialtyRecommendation(BaseModel):
    specialty: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasons: List[str]

class FacilityMatch(BaseModel):
    facility_id: str
    facility_name: str
    facility_type: Literal["clinic", "hospital"]
    distance_km: Optional[float] = None
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None
    availability: str
    emergency_capable: bool
    contact: Optional[str] = None
    location: Optional[dict] = None

class RoutingDecision(BaseModel):
    urgency: UrgencyLevel
    primary_specialty: SpecialtyRecommendation
    alternative_specialties: List[SpecialtyRecommendation] = []
    recommended_facilities: List[FacilityMatch] = []
    recommended_actions: List[str]
    disclaimer: str = "This is AI-generated guidance. Always consult qualified medical professionals."

class SymptomAnalysisResponse(BaseModel):
    request_id: str
    routing_decision: RoutingDecision
    analysis_timestamp: datetime
    processing_time_ms: float

class DoctorInfo(BaseModel):
    name: str
    specialization: str
    experience: int = Field(ge=0)
    availability_hours: str

class ClinicRegistration(BaseModel):
    clinic_name: str
    location: dict = Field(description="{lat, lon, address}")
    doctor: DoctorInfo
    has_nurses: bool
    has_medicine_shop: bool
    fees: Optional[float] = Field(None, ge=0)
    accepts_emergencies: bool
    contact_phone: str

class HospitalDoctor(BaseModel):
    name: str
    specialization: str
    experience: int = Field(ge=0)
    shift_timings: str

class HospitalRegistration(BaseModel):
    hospital_name: str
    hospital_type: Literal["government", "private"]
    location: dict = Field(description="{lat, lon, address}")
    doctors: List[HospitalDoctor] = Field(min_length=1)
    total_rooms: int = Field(ge=0)
    icu_beds: int = Field(ge=0)
    has_emergency_dept: bool
    operation_theatres: int = Field(ge=0)
    nurses_count: int = Field(ge=0)
    services: List[str] = Field(description="MRI, CT, Physiotherapy, etc")
    contact_phone: str

class ClinicResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    clinic_id: str
    clinic_name: str
    location: dict
    doctor: DoctorInfo
    accepts_emergencies: bool
    created_at: datetime

class HospitalResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    hospital_id: str
    hospital_name: str
    hospital_type: str
    location: dict
    doctors_count: int
    has_emergency_dept: bool
    services: List[str]
    created_at: datetime

class TimeSlot(BaseModel):
    day: Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    start_time: str = Field(description="HH:MM format, e.g., 09:00")
    end_time: str = Field(description="HH:MM format, e.g., 17:00")
    slot_duration_minutes: int = Field(default=40, ge=10, le=120)
    max_patients: int = Field(ge=1)

class DoctorAvailability(BaseModel):
    is_online: bool = True
    time_slots: List[TimeSlot] = []

class DoctorProfile(BaseModel):
    doctor_id: str
    full_name: str
    email: str
    specialization: str
    experience_years: int
    license_number: str
    phone: str
    facility_id: str
    facility_name: Optional[str] = None
    facility_type: Optional[str] = None
    availability: DoctorAvailability
    patients_treated: int = 0
    created_at: datetime

class UpdateDoctorAvailability(BaseModel):
    is_online: Optional[bool] = None
    time_slots: Optional[List[TimeSlot]] = None

class PatientRequest(BaseModel):
    request_id: str
    patient_name: str
    patient_age: Optional[int]
    symptoms: str
    urgency_level: str
    requested_at: datetime
    status: Literal["pending", "accepted", "rejected", "completed"] = "pending"

class DoctorStats(BaseModel):
    total_requests: int
    pending_requests: int
    patients_treated: int
    online_status: bool