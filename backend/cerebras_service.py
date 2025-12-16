from langchain_cerebras import ChatCerebras
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import List
import os
import sys
import json

sys.path.append(os.path.dirname(__file__))
from config import get_settings

settings = get_settings()

class CerebrasAnalysisOutput(BaseModel):
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

class CerebrasSymptomAnalyzer:
    def __init__(self):
        self.llm = ChatCerebras(
            model="llama-3.3-70b",
            api_key=settings.CEREBRAS_API_KEY,
            temperature=0.2,
            max_tokens=2000
        )
        self.parser = JsonOutputParser(pydantic_object=CerebrasAnalysisOutput)
    
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

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", user_message)
        ])
        
        try:
            chain = prompt | self.llm | self.parser
            result = await chain.ainvoke({})
            return result
        except Exception as e:
            return {
                "urgency_level": "moderate",
                "urgency_score": 0.5,
                "urgency_justification": "Unable to process symptoms. Please consult a doctor.",
                "primary_specialty": "General Medicine",
                "primary_confidence": 0.3,
                "primary_reasons": ["Default recommendation"],
                "alternative_specialties": [],
                "key_symptoms": [symptom_description[:100]],
                "recommended_actions": ["Consult with a general physician"],
                "critical_warnings": [f"AI analysis failed: {str(e)}"]
            }