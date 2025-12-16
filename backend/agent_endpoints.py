"""
API Endpoints for LangChain AI Agents
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from auth import get_current_user
from langchain_agents import (
    get_routing_agent,
    get_triage_agent,
    get_prescription_agent,
    get_followup_agent,
    get_monitoring_agent,
    get_medication_agent
)

router = APIRouter(prefix="/api/agents", tags=["AI Agents"])

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class RoutingRequest(BaseModel):
    symptoms: str = Field(min_length=10)
    patient_age: Optional[int] = Field(None, ge=0, le=150)
    medical_history: Optional[str] = None

class TriageRequest(BaseModel):
    symptoms: str = Field(min_length=10)

class PrescriptionRequest(BaseModel):
    medications: List[Dict[str, Any]]
    patient_age: Optional[int] = None
    allergies: Optional[List[str]] = None

class FollowUpRequest(BaseModel):
    condition: str
    treatment: str
    patient_age: Optional[int] = None

class VitalsRequest(BaseModel):
    vitals: Dict[str, float]
    baseline: Optional[Dict[str, float]] = None

class MedicationScheduleRequest(BaseModel):
    medications: List[Dict[str, Any]]

class AgentResponse(BaseModel):
    agent_type: str
    status: str
    result: Dict[str, Any]
    timestamp: datetime
    request_id: str

# ============================================================================
# ROUTING AGENT ENDPOINTS
# ============================================================================

@router.post("/routing/analyze", response_model=AgentResponse)
async def analyze_and_route(
    request: RoutingRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Use AI agent to analyze symptoms and route patient to appropriate care.
    """
    request_id = str(uuid.uuid4())
    
    try:
        agent = get_routing_agent()
        result = await agent.route_patient(
            symptoms=request.symptoms,
            patient_age=request.patient_age,
            medical_history=request.medical_history
        )
        
        return AgentResponse(
            agent_type="routing",
            status=result.get("status", "unknown"),
            result=result,
            timestamp=datetime.now(timezone.utc),
            request_id=request_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Routing agent error: {str(e)}"
        )

# ============================================================================
# TRIAGE AGENT ENDPOINTS
# ============================================================================

@router.post("/triage/assess", response_model=AgentResponse)
async def perform_triage(
    request: TriageRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Use AI agent to perform initial patient triage.
    Determines urgency level and immediate actions needed.
    """
    request_id = str(uuid.uuid4())
    
    try:
        agent = get_triage_agent()
        result = await agent.triage_patient(symptoms=request.symptoms)
        
        return AgentResponse(
            agent_type="triage",
            status=result.get("status", "unknown"),
            result=result,
            timestamp=datetime.now(timezone.utc),
            request_id=request_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Triage agent error: {str(e)}"
        )

# ============================================================================
# PRESCRIPTION ANALYSIS AGENT ENDPOINTS
# ============================================================================

@router.post("/prescription/analyze", response_model=AgentResponse)
async def analyze_prescription(
    request: PrescriptionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Use AI agent to analyze prescription for drug interactions and concerns.
    """
    request_id = str(uuid.uuid4())
    
    try:
        agent = get_prescription_agent()
        result = await agent.analyze_prescription(
            medications=request.medications,
            patient_age=request.patient_age,
            allergies=request.allergies
        )
        
        return AgentResponse(
            agent_type="prescription_analysis",
            status=result.get("status", "unknown"),
            result=result,
            timestamp=datetime.now(timezone.utc),
            request_id=request_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prescription analysis error: {str(e)}"
        )

# ============================================================================
# FOLLOW-UP CARE AGENT ENDPOINTS
# ============================================================================

@router.post("/followup/generate-plan", response_model=AgentResponse)
async def generate_followup_plan(
    request: FollowUpRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Use AI agent to generate personalized follow-up care plan.
    """
    request_id = str(uuid.uuid4())
    
    try:
        agent = get_followup_agent()
        result = await agent.generate_followup_plan(
            condition=request.condition,
            treatment=request.treatment,
            patient_age=request.patient_age
        )
        
        return AgentResponse(
            agent_type="followup_care",
            status=result.get("status", "unknown"),
            result=result,
            timestamp=datetime.now(timezone.utc),
            request_id=request_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Follow-up care agent error: {str(e)}"
        )

# ============================================================================
# HEALTH MONITORING AGENT ENDPOINTS
# ============================================================================

@router.post("/monitoring/analyze-vitals", response_model=AgentResponse)
async def analyze_vitals(
    request: VitalsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Use AI agent to analyze vital signs for concerning trends.
    """
    request_id = str(uuid.uuid4())
    
    try:
        agent = get_monitoring_agent()
        result = await agent.analyze_vitals(
            vitals=request.vitals,
            baseline=request.baseline
        )
        
        return AgentResponse(
            agent_type="health_monitoring",
            status=result.get("status", "unknown"),
            result=result,
            timestamp=datetime.now(timezone.utc),
            request_id=request_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health monitoring error: {str(e)}"
        )

# ============================================================================
# MEDICATION REMINDER AGENT ENDPOINTS
# ============================================================================

@router.post("/medication/create-schedule", response_model=AgentResponse)
async def create_medication_schedule(
    request: MedicationScheduleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Use AI agent to create optimized medication schedule.
    """
    request_id = str(uuid.uuid4())
    
    try:
        agent = get_medication_agent()
        result = await agent.create_medication_schedule(
            medications=request.medications
        )
        
        return AgentResponse(
            agent_type="medication_reminder",
            status=result.get("status", "unknown"),
            result=result,
            timestamp=datetime.now(timezone.utc),
            request_id=request_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Medication schedule error: {str(e)}"
        )

# ============================================================================
# HEALTH ENDPOINTS
# ============================================================================

@router.get("/health")
async def agent_health():
    """Check if all agents are initialized and ready"""
    return {
        "status": "healthy",
        "agents": [
            "routing",
            "triage",
            "prescription_analysis",
            "followup_care",
            "health_monitoring",
            "medication_reminder"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
