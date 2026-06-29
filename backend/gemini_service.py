from google import genai
from langsmith import traceable
from pydantic import BaseModel, Field
from typing import List
import os
import sys
import json
import asyncio

sys.path.append(os.path.dirname(__file__))
from config import get_settings
from model_utils import generate_with_fallback

settings = get_settings()

class GeminiAnalysisOutput(BaseModel):
    urgency_level: str = Field(description="critical, moderate, or mild")
    urgency_score: float = Field(description="0.0 to 1.0")
    urgency_justification: str
    primary_specialty: str
    primary_confidence: float
    primary_reasons: List[str]
    alternative_specialties: List[dict] = Field(default=[])
    key_symptoms: List[str]
    recommended_actions: List[str]
    critical_warnings: List[str] = Field(default=[])

class GeminiSymptomAnalyzer:
    def __init__(self):
        # Set up environment variables for LangSmith tracing
        os.environ["LANGSMITH_TRACING"] = "true"
        os.environ["LANGSMITH_ENDPOINT"] = settings.LANGSMITH_ENDPOINT
        os.environ["LANGSMITH_API_KEY"] = settings.LANGSMITH_API_KEY
        os.environ["LANGSMITH_PROJECT"] = settings.LANGSMITH_PROJECT
        
        # Set Google API key (try both environment variable names for compatibility)
        google_api_key = settings.GOOGLE_API_KEY or settings.GOOGLE_GEMINI_API_KEY
        os.environ["GOOGLE_API_KEY"] = google_api_key
        
        # Create Gemini client directly (no wrapper needed)
        self.client = genai.Client()
    
    @traceable(name="analyze_symptoms")
    async def analyze_symptoms(self, symptom_description: str, patient_age: int = None) -> dict:
        system_prompt = """You are an expert medical triage AI assistant for AyuMitraAI. Your role is to:
1. Analyze patient symptoms objectively
2. Determine urgency level (critical, moderate, mild)
3. Recommend appropriate medical specialties
4. Provide actionable next steps
5. Prioritize patient safety above all

**CRITICAL URGENCY INDICATORS** (always mark as CRITICAL):
- Chest pain, pressure, or tightness
- Severe difficulty breathing or shortness of breath
- Sudden severe headache or confusion
- Loss of consciousness or fainting
- Severe bleeding or trauma
- Signs of stroke (facial drooping, arm weakness, speech difficulty)
- Severe allergic reactions
- Suspected heart attack symptoms

**MEDICAL SPECIALTIES (Return EXACTLY one of these):**
- Allergy and Immunology (for allergies, immune reactions, anaphylaxis)
- Anesthesiology (for surgery prep, pain management)
- Cardiology (for heart, chest pain, cardiac conditions)
- Dermatology (for skin rashes, acne, eczema)
- Emergency Medicine (for critical, life-threatening cases)
- Endocrinology (for diabetes, thyroid, hormonal issues)
- Family Medicine (for general care, all ages)
- Gastroenterology (for stomach, digestive, liver)
- Geriatrics (for elderly patients, age-related conditions)
- Gynecology (for female reproductive issues, menstruation, PCOS)
- Hematology (for blood disorders, anemia, clotting)
- Infectious Disease (for infections, fever, tropical diseases)
- Internal Medicine (for complex adult conditions)
- Medical Genetics (for genetic disorders)
- Nephrology (for kidney disease, dialysis)
- Neurology (for seizures, stroke, headaches, neurological conditions)
- Neurosurgery (for brain/spine surgery, tumors, aneurysms)
- Obstetrics (for pregnancy, labor, prenatal care)
- Oncology (for cancer, tumors)
- Ophthalmology (for eye conditions, vision problems)
- Orthopedic Surgery (for bones, joints, fractures, sports injuries)
- Otolaryngology (ENT) (for ear, nose, throat, sinus)
- Pathology (for lab tests, disease diagnosis)
- Pediatrics (for children and infants)
- Physical Medicine and Rehabilitation (for recovery, physiotherapy)
- Plastic Surgery (for reconstructive or cosmetic surgery)
- Psychiatry (for mental health, depression, anxiety)
- Pulmonology (for lungs, breathing, asthma, COPD)
- Radiology (for imaging, X-rays, MRI)
- Rheumatology (for joints, autoimmune, arthritis)
- General Surgery (for surgical procedures)
- Thoracic Surgery (for chest/lung surgery)
- Urology (for kidneys, bladder, urinary tract)
- Vascular Surgery (for blood vessel conditions)
- General Medicine (for conditions not fitting the above)

**IMPORTANT:** Return the specialty name EXACTLY as listed above.

**IMPORTANT:** Never diagnose. Only provide routing guidance."""

        user_message = f"""Analyze these symptoms and provide structured medical routing:

Patient Symptoms: {symptom_description}
{f'Patient Age: {patient_age} years' if patient_age else 'Age: Not provided'}

Provide analysis in this JSON format:
{{
    "urgency_level": "critical|moderate|mild",
    "urgency_score": 0.0-1.0,
    "urgency_justification": "Why this urgency level",
    "primary_specialty": "Most appropriate specialty",
    "primary_confidence": 0.0-1.0,
    "primary_reasons": ["symptom1", "symptom2"],
    "alternative_specialties": [{{"specialty": "name", "confidence": 0.0-1.0, "reasons": ["reason"]}}],
    "key_symptoms": ["identified symptoms"],
    "recommended_actions": ["action steps"],
    "critical_warnings": ["any urgent warnings"]
}}

Be thorough, accurate, and prioritize patient safety."""

        full_prompt = f"{system_prompt}\n\n{user_message}"
        
        try:
            # Model fallback chain: 2.5-flash -> 2.0-flash -> 2.0-flash-lite -> 1.5-flash
            result_str = await generate_with_fallback(self.client, full_prompt)
            
            # Parse JSON from response
            json_start = result_str.find('{')
            json_end = result_str.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = result_str[json_start:json_end]
                result = json.loads(json_str)
                return result
            else:
                raise ValueError("No JSON found in response")
        except Exception as e:
            # Smart Rule-Based Backup Triage Classifier when API key has no quota/fails
            symptom_lower = symptom_description.lower()
            
            # Default
            specialty = "General Medicine"
            urgency_level = "moderate"
            urgency_score = 0.8
            reasons = ["Keyword matching fallback"]
            actions = ["Consult a general physician"]
            warnings = [f"AI analysis bypassed/failed: {str(e)}"]

            # Gynecology / Obstetrics
            if any(k in symptom_lower for k in ["pregnant", "pregnancy", "gynec", "menstrual", "menstruation", "period", "uterus", "ovary", "pcos", "vaginal", "cervical", "reproductive", "fertility", "miscarriage", "labour", "labor", "prenatal", "antenatal"]):
                specialty = "Gynecology"
                urgency_level = "critical" if "pregnant" in symptom_lower and any(k in symptom_lower for k in ["pain", "bleeding", "cramp"]) else "moderate"
                urgency_score = 0.9 if urgency_level == "critical" else 0.8
                reasons = ["Symptoms indicate gynaecological or obstetric concern"]
                actions = ["Rest and avoid strenuous activity", "Contact your OB/GYN immediately if pain is severe"]
                warnings = ["Severe pain or bleeding during pregnancy requires emergency care."] if "pregnant" in symptom_lower else []
            
            # Psychiatry
            elif any(k in symptom_lower for k in ["depression", "anxiety", "mental", "suicidal", "panic", "hallucination", "schizophrenia", "bipolar", "ocd", "ptsd", "phobia", "stress disorder"]):
                specialty = "Psychiatry"
                urgency_level = "critical" if any(k in symptom_lower for k in ["suicidal", "self-harm", "overdose"]) else "moderate"
                urgency_score = 0.95 if urgency_level == "critical" else 0.8
                reasons = ["Mental health symptoms detected"]
                actions = ["Speak to a trusted person", "Call a mental health helpline if in crisis"]
                warnings = ["If you are having thoughts of self-harm, please call emergency services immediately."] if urgency_level == "critical" else []

            # Pediatrics
            elif any(k in symptom_lower for k in ["child", "infant", "baby", "toddler", "newborn", "pediatric", "kid"]):
                specialty = "Pediatrics"
                urgency_level = "moderate"
                urgency_score = 0.8
                reasons = ["Pediatric patient symptoms detected"]
                actions = ["Monitor child's temperature and hydration", "Consult a paediatrician"]

            # Urology
            elif any(k in symptom_lower for k in ["urine", "urinary", "kidney stone", "bladder", "prostate", "uti", "urethra", "burning urination"]):
                specialty = "Urology"
                urgency_level = "moderate"
                urgency_score = 0.85
                reasons = ["Urinary or urological symptoms detected"]
                actions = ["Increase water intake", "Avoid holding urine"]

            # Endocrinology
            elif any(k in symptom_lower for k in ["diabetes", "thyroid", "hormonal", "insulin", "blood sugar", "hypoglycemia", "hyperglycemia", "hyperthyroid", "hypothyroid", "adrenal"]):
                specialty = "Endocrinology"
                urgency_level = "moderate"
                urgency_score = 0.8
                reasons = ["Endocrine or metabolic symptoms detected"]
                actions = ["Monitor blood sugar levels if diabetic", "Take prescribed medications on schedule"]

            # ENT
            elif any(k in symptom_lower for k in ["ear", "hearing", "nose", "sinus", "throat", "tonsil", "nasal", "snoring", "voice", "larynx", "ent"]):
                specialty = "Otolaryngology (ENT)"
                urgency_level = "mild"
                urgency_score = 0.75
                reasons = ["Ear, nose, or throat symptoms detected"]
                actions = ["Avoid cold fluids", "Use steam inhalation for sinus relief"]

            # Oncology
            elif any(k in symptom_lower for k in ["cancer", "tumor", "lump", "mass", "biopsy", "malignant", "chemotherapy", "oncology"]):
                specialty = "Oncology"
                urgency_level = "critical"
                urgency_score = 0.95
                reasons = ["Potential oncological symptoms detected"]
                actions = ["Schedule an urgent appointment with an oncologist"]
                warnings = ["Do not delay — early cancer detection significantly improves outcomes."]

            # Rheumatology
            elif any(k in symptom_lower for k in ["arthritis", "lupus", "autoimmune", "rheumatoid", "gout", "inflamed joint", "rheumatology"]):
                specialty = "Rheumatology"
                urgency_level = "moderate"
                urgency_score = 0.8
                reasons = ["Autoimmune or rheumatological symptoms detected"]
                actions = ["Rest the affected joints", "Apply warm/cold compress"]

            # Nephrology
            elif any(k in symptom_lower for k in ["kidney", "renal", "dialysis", "creatinine", "nephritis", "nephrotic"]):
                specialty = "Nephrology"
                urgency_level = "moderate"
                urgency_score = 0.85
                reasons = ["Kidney or renal symptoms detected"]
                actions = ["Limit protein intake", "Monitor fluid intake and output"]

            # Allergy
            elif any(k in symptom_lower for k in ["allergy", "allergic", "hives", "anaphylaxis", "allergic reaction", "food allergy", "immunology"]):
                specialty = "Allergy and Immunology"
                urgency_level = "critical" if "anaphylaxis" in symptom_lower else "moderate"
                urgency_score = 0.9 if "anaphylaxis" in symptom_lower else 0.8
                reasons = ["Allergic or immune reaction detected"]
                actions = ["Identify and avoid the allergen", "Take antihistamines if prescribed"]
                warnings = ["Anaphylaxis is life-threatening — use epinephrine auto-injector if available."] if "anaphylaxis" in symptom_lower else []

            # Cardiology rules
            elif any(k in symptom_lower for k in ["heart", "chest pain", "cardiac", "palpitation", "angina", "chest pressure"]):
                specialty = "Cardiology"
                urgency_level = "critical"
                urgency_score = 0.95
                reasons = ["Symptoms indicate potential cardiac concern (heart/chest pain)"]
                actions = ["Seek immediate medical attention", "Refrain from physical exertion"]
                warnings = ["Potential heart attack risk. Go to the nearest emergency room if symptoms worsen."]
            
            # Neurology rules
            elif any(k in symptom_lower for k in ["seizure", "stroke", "migraine", "severe headache", "numbness", "brain", "paralysis"]):
                specialty = "Neurology"
                urgency_level = "critical" if "stroke" in symptom_lower or "paralysis" in symptom_lower else "moderate"
                urgency_score = 0.9
                reasons = ["Symptoms point to neurological involvement"]
                actions = ["Rest in a quiet room", "Monitor neurological responses"]
            
            # Orthopedics rules
            elif any(k in symptom_lower for k in ["bone", "joint", "fracture", "spine", "back pain", "knee", "shoulder", "sprain"]):
                specialty = "Orthopedic Surgery"
                urgency_level = "moderate"
                urgency_score = 0.85
                reasons = ["Symptoms suggest bone or joint issues"]
                actions = ["Avoid putting weight on the affected area", "Apply ice if swelling is present"]
            
            # Pulmonology rules
            elif any(k in symptom_lower for k in ["breath", "lung", "cough", "asthma", "wheezing", "shortness of breath"]):
                specialty = "Pulmonology"
                urgency_level = "critical" if "shortness of breath" in symptom_lower or "breathing" in symptom_lower else "moderate"
                urgency_score = 0.9
                reasons = ["Respiratory symptoms detected"]
                actions = ["Maintain comfortable sitting posture", "Use prescribed inhalers if applicable"]
            
            # Gastroenterology rules
            elif any(k in symptom_lower for k in ["stomach", "vomit", "diarrhea", "nausea", "gastro", "abdomen", "digestive"]):
                specialty = "Gastroenterology"
                urgency_level = "moderate"
                urgency_score = 0.8
                reasons = ["Gastrointestinal symptoms detected"]
                actions = ["Stay hydrated", "Consume light bland foods"]

            # Dermatology rules
            elif any(k in symptom_lower for k in ["skin", "rash", "itch", "dermatology", "eczema", "burn"]):
                specialty = "Dermatology"
                urgency_level = "mild"
                urgency_score = 0.85
                reasons = ["Dermatological signs observed"]
                actions = ["Keep the area clean", "Avoid scratching"]

            # Ophthalmology rules
            elif any(k in symptom_lower for k in ["eye", "vision", "blind", "cornea", "redness in eye"]):
                specialty = "Ophthalmology"
                urgency_level = "moderate"
                urgency_score = 0.85
                reasons = ["Ocular symptoms reported"]
                actions = ["Rest your eyes", "Avoid rubbing your eyes"]

            return {
                "urgency_level": urgency_level,
                "urgency_score": urgency_score,
                "urgency_justification": f"Fallback rule-based triage: {reasons[0]}",
                "primary_specialty": specialty,
                "primary_confidence": urgency_score,
                "primary_reasons": reasons,
                "alternative_specialties": [],
                "key_symptoms": [symptom_description[:100]],
                "recommended_actions": actions,
                "critical_warnings": warnings
            }

