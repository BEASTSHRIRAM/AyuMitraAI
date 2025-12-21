"""
LangChain AI for symptom analysis using Groq
Simplified version without agents for Motia compatibility
"""

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
import os
import json
import re

# Initialize Groq LLM
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
llm = ChatGroq(
    model="mixtral-8x7b-32768",
    temperature=0.3,
    api_key=GROQ_API_KEY,
    max_tokens=2000
)

# Motia Event Step Configuration
config = {
    "name": "AnalyzeSymptomsAI",
    "type": "event",
    "description": "AI-powered symptom analysis using LangChain + Groq",
    "subscribes": ["analyze-symptoms-ai"],
    "emits": ["symptoms-analyzed-ai"],
    "input": {
        "type": "object",
        "properties": {
            "request_id": {"type": "string"},
            "symptom_description": {"type": "string"},
            "patient_age": {"type": "integer"},
            "patient_location": {"type": "object"}
        },
        "required": ["request_id", "symptom_description"]
    }
}

async def handler(input_data, context):
    """
    Motia event handler for symptom analysis using Groq
    """
    try:
        request_id = input_data.get("request_id")
        symptom_description = input_data.get("symptom_description")
        patient_age = input_data.get("patient_age")
        
        context.logger.info("Starting AI symptom analysis", {
            "request_id": request_id,
            "symptom_length": len(symptom_description)
        })
        
        # Prepare prompt for Groq
        system_prompt = """You are an expert medical AI assistant for AyuMitraAI.
Analyze patient symptoms and provide a structured medical assessment.

CRITICAL RED FLAGS (Always mark as critical):
- Chest pain or pressure
- Severe difficulty breathing
- Sudden severe headache
- Loss of consciousness
- Severe bleeding
- Signs of stroke
- Severe allergic reaction
- Severe abdominal pain

Respond ONLY with valid JSON in this exact format:
{
    "urgency_level": "critical|moderate|mild",
    "urgency_score": 0.0-1.0,
    "urgency_justification": "explanation",
    "primary_specialty": "specialty name",
    "primary_confidence": 0.0-1.0,
    "primary_reasons": ["reason1", "reason2"],
    "alternative_specialties": [
        {"specialty": "name", "confidence": 0.0-1.0, "reasons": ["reason1"]}
    ],
    "critical_warnings": ["warning1"],
    "recommended_actions": ["action1", "action2"]
}"""

        user_message = f"""Analyze these patient symptoms:

Symptoms: {symptom_description}
{f'Age: {patient_age}' if patient_age else ''}

Provide medical assessment as JSON only."""

        # Call Groq LLM
        response = llm.invoke([
            HumanMessage(content=system_prompt + "\n\n" + user_message)
        ])
        
        output_text = response.content
        
        # Extract JSON from response
        try:
            json_match = re.search(r'\{.*\}', output_text, re.DOTALL)
            if json_match:
                analysis = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")
        except (json.JSONDecodeError, ValueError):
            context.logger.warn("Failed to parse AI response as JSON", {
                "request_id": request_id,
                "output": output_text[:200]
            })
            analysis = {
                "urgency_level": "moderate",
                "urgency_score": 0.5,
                "urgency_justification": "Unable to parse AI response",
                "primary_specialty": "General Medicine",
                "primary_confidence": 0.5,
                "primary_reasons": ["Requires specialist evaluation"],
                "alternative_specialties": [],
                "critical_warnings": [],
                "recommended_actions": ["Consult with a healthcare professional"]
            }
        
        context.logger.info("AI symptom analysis completed", {
            "request_id": request_id,
            "urgency": analysis.get("urgency_level"),
            "specialty": analysis.get("primary_specialty")
        })
        
        # Emit event with analysis results
        await context.emit({
            "topic": "symptoms-analyzed-ai",
            "data": {
                "request_id": request_id,
                "symptom_description": symptom_description,
                "patient_age": patient_age,
                "analysis": analysis,
                "timestamp": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).isoformat()
            }
        })
        
        context.logger.info("AI analysis event emitted", {"request_id": request_id})
        
    except Exception as e:
        context.logger.error("AI symptom analysis failed", {
            "error": str(e),
            "request_id": input_data.get("request_id")
        })
        raise
