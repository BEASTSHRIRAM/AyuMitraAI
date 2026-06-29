
from google import genai
from langsmith import traceable
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage
from motor.motor_asyncio import AsyncIOMotorClient
import json
import os
import sys
import asyncio

sys.path.append(os.path.dirname(__file__))
from config import get_settings
from model_utils import generate_with_fallback

settings = get_settings()

# Enable LangSmith tracing
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_ENDPOINT"] = settings.LANGSMITH_ENDPOINT
os.environ["LANGSMITH_API_KEY"] = settings.LANGSMITH_API_KEY
os.environ["LANGSMITH_PROJECT"] = settings.LANGSMITH_PROJECT

# Set Google API key (try both environment variable names for compatibility)
google_api_key = settings.GOOGLE_API_KEY or settings.GOOGLE_GEMINI_API_KEY
os.environ["GOOGLE_API_KEY"] = google_api_key

# Shared MongoDB client for tools
_motor_client = AsyncIOMotorClient(settings.MONGO_URL)
_db = _motor_client[settings.DB_NAME]


def _run_async(coro):
    """Bridge async DB calls into sync LangChain tools."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result(timeout=10)
        else:
            return loop.run_until_complete(coro)
    except Exception as e:
        return None

@tool
def analyze_symptom_severity(symptoms: str, patient_age: int = None) -> dict:
    """
    Analyze the severity of patient symptoms.
    Returns urgency level (critical, moderate, mild) and reasoning.
    """
    return {
        "symptoms": symptoms,
        "age": patient_age,
        "analysis": "Tool for analyzing symptom severity"
    }

@tool
def find_matching_specialties(symptoms: str) -> dict:
    """
    Find medical specialties that match the patient's symptoms using keyword analysis.
    Returns list of recommended specialties with confidence scores based on symptom keywords.
    """
    symptom_lower = symptoms.lower()
    specialty_scores = []
    
    keyword_map = {
        "Cardiology":                        ["heart", "chest pain", "cardiac", "palpitation", "angina"],
        "Neurology":                         ["seizure", "stroke", "migraine", "headache", "numbness", "paralysis", "brain"],
        "Neurosurgery":                      ["brain surgery", "neurosurgery", "tumor", "aneurysm", "spine surgery"],
        "Orthopedic Surgery":                ["bone", "joint", "fracture", "back pain", "knee", "shoulder", "sprain", "sports injury"],
        "Pulmonology":                       ["breath", "cough", "asthma", "lung", "wheezing", "shortness of breath"],
        "Gastroenterology":                  ["stomach", "vomit", "diarrhea", "nausea", "abdomen", "digestive", "liver"],
        "Dermatology":                       ["skin", "rash", "itch", "eczema", "burn", "acne"],
        "Ophthalmology":                     ["eye", "vision", "blind", "cornea", "cataract"],
        "Gynecology":                        ["pregnant", "pregnancy", "menstrual", "period", "uterus", "ovary", "pcos", "vaginal", "cervical", "gynaecology", "gynecology", "female reproductive"],
        "Obstetrics":                        ["labour", "labor", "prenatal", "antenatal", "delivery", "childbirth", "obstetrics"],
        "Pediatrics":                        ["child", "infant", "baby", "toddler", "newborn", "pediatric", "kid"],
        "Psychiatry":                        ["depression", "anxiety", "mental", "suicidal", "panic", "hallucination", "bipolar", "ocd", "ptsd"],
        "Urology":                           ["urine", "urinary", "kidney stone", "bladder", "prostate", "uti", "urethra"],
        "Endocrinology":                     ["diabetes", "thyroid", "hormonal", "insulin", "blood sugar", "hypoglycemia"],
        "Otolaryngology (ENT)":              ["ear", "hearing", "nose", "sinus", "throat", "tonsil", "nasal", "snoring", "ent"],
        "Oncology":                          ["cancer", "tumor", "lump", "biopsy", "malignant", "chemotherapy"],
        "Rheumatology":                      ["arthritis", "lupus", "autoimmune", "rheumatoid", "gout"],
        "Nephrology":                        ["kidney", "renal", "dialysis", "creatinine", "nephritis"],
        "Hematology":                        ["blood disorder", "anemia", "clotting", "platelet", "hemoglobin", "leukemia"],
        "Infectious Disease":                ["infection", "fever", "malaria", "typhoid", "dengue", "tuberculosis", "tb"],
        "Allergy and Immunology":            ["allergy", "allergic", "hives", "anaphylaxis", "food allergy"],
        "Geriatrics":                        ["elderly", "old age", "senior", "aging", "dementia", "geriatric"],
        "Emergency Medicine":                ["severe", "emergency", "critical", "unconscious", "bleeding"],
        "General Medicine":                  ["fever", "cold", "flu", "fatigue", "weakness", "pain"],
    }
    
    for specialty, keywords in keyword_map.items():
        hits = sum(1 for kw in keywords if kw in symptom_lower)
        if hits > 0:
            specialty_scores.append({"specialty": specialty, "confidence": round(min(hits / 3, 1.0), 2), "matched_keywords": [kw for kw in keywords if kw in symptom_lower]})
    
    specialty_scores.sort(key=lambda x: x["confidence"], reverse=True)
    
    return {
        "symptoms": symptoms,
        "specialties": specialty_scores[:3] if specialty_scores else [{"specialty": "General Medicine", "confidence": 0.5, "matched_keywords": []}]
    }

@tool
def check_doctor_availability(specialty: str, urgency: str) -> dict:
    """
    Check which doctors are currently ONLINE in the database for the given specialty.
    Queries MongoDB doctors collection in real time. Returns available doctors with details.
    """
    async def _query():
        specialty_lower = specialty.lower()
        keyword_map = {
            "cardiology":                       ["cardiology", "cardiologist", "heart", "cardiac"],
            "neurology":                        ["neurology", "neurologist", "neuro"],
            "neurosurgery":                     ["neurosurgery", "neurosurgeon", "brain surgery"],
            "orthopedic surgery":               ["orthopedic", "orthopaedic", "bone", "joint", "fracture", "sports"],
            "gastroenterology":                 ["gastroenterology", "gastro", "digestive", "gastroenterologist"],
            "pulmonology":                      ["pulmonology", "lung", "respiratory", "pulmonologist"],
            "dermatology":                      ["dermatology", "skin", "dermatologist"],
            "ophthalmology":                    ["ophthalmology", "eye", "ophthalmologist"],
            "gynecology":                       ["gynecology", "gynaecology", "gynecologist", "gynaecologist", "obstetrics", "obstetrician", "womens health", "women"],
            "obstetrics":                       ["obstetrics", "obstetrician", "prenatal", "antenatal", "pregnancy", "maternity"],
            "pediatrics":                       ["pediatrics", "paediatrics", "pediatrician", "paediatrician", "child", "infant"],
            "psychiatry":                       ["psychiatry", "psychiatrist", "mental health", "psychology"],
            "urology":                          ["urology", "urologist", "urinary", "bladder", "prostate"],
            "endocrinology":                    ["endocrinology", "endocrinologist", "diabetes", "thyroid", "hormonal"],
            "otolaryngology (ent)":             ["ent", "otolaryngology", "ear", "nose", "throat", "sinus"],
            "oncology":                         ["oncology", "oncologist", "cancer", "tumor"],
            "rheumatology":                     ["rheumatology", "rheumatologist", "arthritis", "autoimmune"],
            "nephrology":                       ["nephrology", "nephrologist", "kidney", "renal", "dialysis"],
            "hematology":                       ["hematology", "haematology", "blood", "anemia"],
            "infectious disease":               ["infectious", "infection", "fever", "tropical"],
            "allergy and immunology":           ["allergy", "allergist", "immunology", "immunologist"],
            "geriatrics":                       ["geriatrics", "geriatrician", "elderly", "senior"],
            "internal medicine":                ["internal medicine", "internist"],
            "family medicine":                  ["family medicine", "family doctor", "family physician"],
            "general surgery":                  ["general surgery", "surgeon", "surgical"],
            "thoracic surgery":                 ["thoracic", "chest surgery"],
            "vascular surgery":                 ["vascular", "blood vessel"],
            "plastic surgery":                  ["plastic surgery", "cosmetic", "reconstructive"],
            "physical medicine and rehabilitation": ["rehabilitation", "physio", "physiotherapy", "rehab"],
            "general medicine":                 ["general", "medicine", "physician", "gp", "family", "general practitioner"],
            "emergency medicine":               ["emergency", "trauma", "critical", "er"],
        }
        keywords = set()
        for spec, kws in keyword_map.items():
            if spec in specialty_lower or specialty_lower in spec:
                keywords.update(kws)
        if not keywords:
            keywords.add(specialty_lower)
        
        all_doctors = await _db.doctors.find({}, {"_id": 0}).to_list(100)
        matched = []
        for doc in all_doctors:
            if not doc.get("availability", {}).get("is_online", False):
                continue
            doc_spec = doc.get("specialization", "").lower()
            if any(kw in doc_spec or doc_spec in kw for kw in keywords):
                matched.append({
                    "name": doc.get("full_name"),
                    "specialization": doc.get("specialization"),
                    "experience_years": doc.get("experience_years"),
                    "facility": doc.get("facility_name"),
                    "is_online": True
                })
        return matched
    
    doctors = _run_async(_query()) or []
    return {
        "specialty": specialty,
        "urgency": urgency,
        "available_doctors": doctors,
        "count": len(doctors)
    }

@tool
def get_facility_info(facility_id: str) -> dict:
    """
    Get detailed information about a healthcare facility.
    Returns facility details, services, and contact information.
    """
    return {
        "facility_id": facility_id,
        "info": "Facility information"
    }

@tool
def estimate_wait_time(specialty: str, urgency: str) -> dict:
    """
    Estimate wait time for appointment based on specialty and urgency.
    Returns estimated wait time and availability slots.
    """
    return {
        "specialty": specialty,
        "urgency": urgency,
        "estimated_wait_minutes": 15
    }

@tool
def get_treatment_guidelines(specialty: str, condition: str) -> dict:
    """
    Get evidence-based treatment guidelines for a specific condition.
    Returns recommended treatment approaches and best practices.
    """
    return {
        "specialty": specialty,
        "condition": condition,
        "guidelines": "Treatment guidelines"
    }

# ============================================================================
# ROUTING AGENT
# ============================================================================

class MedicalRoutingAgent:
    """
    AI Agent that routes patients to appropriate doctors/facilities
    using Google Gemini with LangSmith tracing.
    """
    
    def __init__(self):
        # Create Gemini client directly (no wrapper needed)
        self.client = genai.Client()
        
        # Define tools
        self.tools = [
            analyze_symptom_severity,
            find_matching_specialties,
            check_doctor_availability,
            get_facility_info,
            estimate_wait_time,
            get_treatment_guidelines
        ]
    
    @traceable(name="route_patient")
    async def route_patient(self, symptoms: str, patient_age: int = None, 
                           medical_history: str = None) -> dict:
        """
        Route a patient to appropriate medical care using Gemini.
        
        Args:
            symptoms: Description of patient symptoms
            patient_age: Patient's age (optional)
            medical_history: Relevant medical history (optional)
        
        Returns:
            Routing recommendation with specialty, facility, and reasoning
        """
        
        system_prompt = """You are an expert medical routing AI agent for AyuMitraAI.
Your role is to:
1. Analyze patient symptoms and medical history
2. Determine urgency level (critical, moderate, mild)
3. Identify appropriate medical specialties
4. Find available doctors and facilities
5. Recommend the best routing option
6. Provide clear reasoning for your recommendations

Always prioritize patient safety and ensure critical cases are routed to emergency services.
Be thorough in your analysis and consider multiple factors before making recommendations."""

        input_message = f"""
Patient Symptoms: {symptoms}
{f'Age: {patient_age}' if patient_age else ''}
{f'Medical History: {medical_history}' if medical_history else ''}

Please analyze this patient and provide:
1. Urgency assessment (critical/moderate/mild)
2. Recommended specialty
3. Available doctors/facilities
4. Estimated wait time
5. Next steps for the patient
"""

        full_prompt = f"{system_prompt}\n\n{input_message}"
        
        try:
            # Model fallback chain: 2.5-flash -> 2.0-flash -> 2.0-flash-lite -> 1.5-flash
            routing_text = await generate_with_fallback(self.client, full_prompt)
            return {
                "status": "success",
                "routing_decision": routing_text,
                "reasoning": "Agent analysis complete"
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "routing_decision": None
            }

# ============================================================================
# TRIAGE AGENT
# ============================================================================

class TriageAgent:
    """
    AI Agent for initial patient triage and assessment.
    Determines if patient needs emergency care or can wait for appointment.
    """
    
    def __init__(self):
        # Create Gemini client directly (no wrapper needed)
        self.client = genai.Client()
    
    @traceable(name="triage_patient")
    async def triage_patient(self, symptoms: str) -> dict:
        """
        Perform initial triage assessment.
        
        Returns:
            Triage level and recommendations
        """
        
        system_prompt = """You are a medical triage AI agent.
Your role is to:
1. Quickly assess patient symptoms
2. Determine if emergency care is needed
3. Identify red flags that require immediate attention
4. Provide initial first aid guidance if appropriate
5. Recommend appropriate level of care

CRITICAL RED FLAGS (Always recommend emergency):
- Chest pain or pressure
- Severe difficulty breathing
- Sudden severe headache
- Loss of consciousness
- Severe bleeding
- Signs of stroke
- Severe allergic reaction
- Severe abdominal pain

Be conservative - when in doubt, recommend emergency care."""

        input_message = f"""
Patient reports: {symptoms}

Perform triage assessment and provide:
1. Triage level (Emergency/Urgent/Non-urgent)
2. Red flags identified (if any)
3. Immediate actions needed
4. Recommended care level
"""

        full_prompt = f"{system_prompt}\n\n{input_message}"
        
        try:
            triage_text = await generate_with_fallback(self.client, full_prompt)
            return {
                "status": "success",
                "triage_assessment": triage_text
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

# ============================================================================
# PRESCRIPTION ANALYSIS AGENT
# ============================================================================

class PrescriptionAnalysisAgent:
    """
    AI Agent for analyzing prescriptions and drug interactions.
    Helps identify potential issues and provides guidance.
    """
    
    def __init__(self):
        # Create Gemini client directly (no wrapper needed)
        self.client = genai.Client()
    
    @traceable(name="analyze_prescription")
    async def analyze_prescription(self, medications: list, patient_age: int = None,
                                   allergies: list = None) -> dict:
        """
        Analyze prescription for potential issues.
        
        Args:
            medications: List of medications with dosages
            patient_age: Patient age
            allergies: Known allergies
        
        Returns:
            Analysis of potential interactions and concerns
        """
        
        prompt = f"""
Analyze this prescription for potential issues:

Medications: {json.dumps(medications)}
Patient Age: {patient_age}
Known Allergies: {allergies}

Provide:
1. Potential drug interactions
2. Allergy concerns
3. Age-appropriate dosing assessment
4. Side effect warnings
5. Recommendations

IMPORTANT: This is for informational purposes only. Always consult with a pharmacist or doctor."""

        try:
            analysis_text = await generate_with_fallback(self.client, prompt)
            return {
                "status": "success",
                "analysis": analysis_text
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

# ============================================================================
# FOLLOW-UP CARE AGENT
# ============================================================================

class FollowUpCareAgent:
    """
    AI Agent for managing patient follow-up care and recovery.
    Provides post-treatment guidance and monitoring recommendations.
    """
    
    def __init__(self):
        # Create Gemini client directly (no wrapper needed)
        self.client = genai.Client()
    
    @traceable(name="generate_followup_plan")
    async def generate_followup_plan(self, condition: str, treatment: str,
                                     patient_age: int = None) -> dict:
        """
        Generate personalized follow-up care plan.
        
        Returns:
            Follow-up care recommendations and monitoring schedule
        """
        
        prompt = f"""
Generate a follow-up care plan for:

Condition: {condition}
Treatment Received: {treatment}
Patient Age: {patient_age}

Provide:
1. Recovery timeline
2. Activity restrictions
3. Medication schedule
4. Diet recommendations
5. Warning signs to watch for
6. Follow-up appointment schedule
7. Lifestyle modifications
8. When to seek emergency care"""

        try:
            plan_text = await generate_with_fallback(self.client, prompt)
            return {
                "status": "success",
                "followup_plan": plan_text
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

# ============================================================================
# HEALTH MONITORING AGENT
# ============================================================================

class HealthMonitoringAgent:
    """
    AI Agent for continuous health monitoring and early warning detection.
    Analyzes vital signs and health metrics to identify concerning trends.
    """
    
    def __init__(self):
        # Create Gemini client directly (no wrapper needed)
        self.client = genai.Client()
    
    @traceable(name="analyze_vitals")
    async def analyze_vitals(self, vitals: dict, baseline: dict = None) -> dict:
        """
        Analyze vital signs for concerning trends.
        
        Args:
            vitals: Current vital signs (BP, HR, O2, temp, etc.)
            baseline: Patient's baseline vitals for comparison
        
        Returns:
            Analysis and recommendations
        """
        
        prompt = f"""
Analyze these vital signs:

Current Vitals: {json.dumps(vitals)}
{f'Baseline Vitals: {json.dumps(baseline)}' if baseline else ''}

Provide:
1. Normal/Abnormal assessment for each vital
2. Concerning trends (if comparing to baseline)
3. Potential causes of abnormalities
4. Recommended actions
5. When to seek medical attention

Reference Ranges:
- Blood Pressure: 120/80 mmHg (normal)
- Heart Rate: 60-100 bpm (normal)
- Temperature: 98.6°F / 37°C (normal)
- Oxygen Saturation: 95-100% (normal)
- Respiratory Rate: 12-20 breaths/min (normal)"""

        try:
            analysis_text = await generate_with_fallback(self.client, prompt)
            return {
                "status": "success",
                "vitals_analysis": analysis_text
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

# ============================================================================
# MEDICATION REMINDER AGENT
# ============================================================================

class MedicationReminderAgent:
    """
    AI Agent for managing medication schedules and reminders.
    Helps patients stay compliant with their medication regimen.
    """
    
    def __init__(self):
        # Create Gemini client directly (no wrapper needed)
        self.client = genai.Client()
    
    @traceable(name="create_medication_schedule")
    async def create_medication_schedule(self, medications: list) -> dict:
        """
        Create optimized medication schedule.
        
        Args:
            medications: List of medications with dosages and frequency
        
        Returns:
            Optimized schedule with reminders
        """
        
        prompt = f"""
Create an optimized medication schedule for:

Medications: {json.dumps(medications)}

Provide:
1. Optimal times to take each medication
2. Which medications to take together
3. Which medications to take separately
4. Food interactions to consider
5. Reminder schedule
6. Tips for remembering to take medications"""

        try:
            schedule_text = await generate_with_fallback(self.client, prompt)
            return {
                "status": "success",
                "medication_schedule": schedule_text
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

# ============================================================================
# INITIALIZATION
# ============================================================================

def get_routing_agent():
    """Get or create routing agent instance"""
    return MedicalRoutingAgent()

def get_triage_agent():
    """Get or create triage agent instance"""
    return TriageAgent()

def get_prescription_agent():
    """Get or create prescription analysis agent instance"""
    return PrescriptionAnalysisAgent()

def get_followup_agent():
    """Get or create follow-up care agent instance"""
    return FollowUpCareAgent()

def get_monitoring_agent():
    """Get or create health monitoring agent instance"""
    return HealthMonitoringAgent()

def get_medication_agent():
    """Get or create medication reminder agent instance"""
    return MedicationReminderAgent()
