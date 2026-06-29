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
- Neurosurgery (for brain surgery, tumors, aneurysms)
- Neurology (for neurological conditions, seizures)
- Cardiology (for heart conditions)
- Orthopedics (for bone/joint issues)
- Gastroenterology (for digestive issues)
- Pulmonology (for lung/respiratory issues)
- Dermatology (for skin issues)
- Ophthalmology (for eye issues)
- General Medicine (for general conditions)
- Emergency Medicine (for critical cases)

**IMPORTANT:** Return the specialty name EXACTLY as listed above. Do not use variations like "Neurosurgeon" or "Cardiologist".

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
            # Make a traced Gemini call using async wrapper for non-blocking execution
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model="gemini-2.0-flash",
                contents=full_prompt,
            )
            
            result_str = response.text
            
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

            # Cardiology rules
            if any(k in symptom_lower for k in ["heart", "chest pain", "cardiac", "palpitation", "angina", "chest pressure"]):
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
                specialty = "Orthopedics"
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

