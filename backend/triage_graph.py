"""LangGraph multi-agent pipeline powering the AyuMitra Health Copilot.

Topology:
    triage_agent --> research_agent --> report_agent --> END
         |                                  ^
         +------- (no location given) -----+

Each node is a specialist agent:
- triage_agent: analyzes symptoms, urgency and specialty (Gemini)
- research_agent: finds real doctors for the specialty near the patient (Firecrawl)
- report_agent: composes a patient-friendly markdown summary (Gemini)
"""
from typing import List, Optional, TypedDict

import asyncio
import json
import logging
import os
import sys

from langgraph.graph import END, StateGraph
from langsmith import traceable

sys.path.append(os.path.dirname(__file__))
from model_utils import generate_with_fallback
from config import get_settings
from doctor_scraper import DoctorScraper
from gemini_service import GeminiSymptomAnalyzer

logger = logging.getLogger("ayumitra.copilot")
settings = get_settings()


class TriageState(TypedDict, total=False):
    symptom_description: str
    patient_age: Optional[int]
    location: Optional[str]
    analysis: Optional[dict]
    doctors: List[dict]
    report: Optional[str]
    error: Optional[str]


class HealthCopilotGraph:
    """Supervisor-style LangGraph chaining triage, research and report agents."""

    def __init__(self):
        self.analyzer = GeminiSymptomAnalyzer()
        self.client = self.analyzer.client
        try:
            self.scraper = DoctorScraper()
        except Exception as exc:  # e.g. missing Firecrawl API key
            logger.warning("Research agent disabled (DoctorScraper init failed): %s", exc)
            self.scraper = None
        self.graph = self._build()

    def _build(self):
        builder = StateGraph(TriageState)
        builder.add_node("triage_agent", self.triage_agent)
        builder.add_node("research_agent", self.research_agent)
        builder.add_node("report_agent", self.report_agent)
        builder.set_entry_point("triage_agent")
        builder.add_conditional_edges(
            "triage_agent",
            self._route_after_triage,
            {"research": "research_agent", "report": "report_agent"},
        )
        builder.add_edge("research_agent", "report_agent")
        builder.add_edge("report_agent", END)
        return builder.compile()

    def _route_after_triage(self, state: TriageState) -> str:
        if state.get("location") and self.scraper is not None:
            return "research"
        return "report"

    @traceable(name="copilot_triage_agent")
    async def triage_agent(self, state: TriageState) -> dict:
        analysis = await self.analyzer.analyze_symptoms(
            state["symptom_description"], state.get("patient_age")
        )
        return {"analysis": analysis}

    @traceable(name="copilot_research_agent")
    async def research_agent(self, state: TriageState) -> dict:
        analysis = state.get("analysis") or {}
        specialty = analysis.get("primary_specialty", "General Medicine")
        try:
            doctors = await self.scraper.search_doctors(specialty, state["location"], limit=5)
            return {"doctors": doctors or []}
        except Exception as exc:
            logger.error("Research agent failed: %s", exc)
            return {"doctors": [], "error": "Doctor research is temporarily unavailable."}

    @traceable(name="copilot_report_agent")
    async def report_agent(self, state: TriageState) -> dict:
        analysis = state.get("analysis") or {}
        doctors = state.get("doctors") or []
        prompt = f"""You are the report-writing agent of AyuMitraAI's multi-agent health copilot.
Write a clear, compassionate, patient-friendly summary in Markdown using ONLY the structured data below.

Rules:
- Never diagnose. Provide routing guidance only.
- If urgency is critical, the first line must clearly instruct the patient to seek emergency care immediately.
- Start with a short paragraph summarising the situation.
- Add a \"What to do next\" section using the recommended actions.
- If doctors are listed, add a \"Doctors that may help\" section with their name, designation and contact if available.
- End with a one-line reminder that this is not a medical diagnosis.
- Maximum 300 words. No emojis.

Triage analysis:
{json.dumps(analysis, indent=2)}

Doctors found:
{json.dumps(doctors, indent=2)}

Patient location: {state.get("location") or "Not provided"}
"""
        try:
            report_text = await generate_with_fallback(self.client, prompt)
            return {"report": report_text}
        except Exception as exc:
            logger.error("Report agent failed: %s", exc)
            actions = "\n".join(f"- {a}" for a in analysis.get("recommended_actions", []))
            fallback = (
                f"## Summary\n\n{analysis.get('urgency_justification', 'Please consult a doctor.')}\n\n"
                f"**Recommended specialty:** {analysis.get('primary_specialty', 'General Medicine')}\n\n"
                f"### What to do next\n{actions or '- Consult a general physician.'}\n\n"
                "This is not a medical diagnosis."
            )
            return {"report": fallback, "error": "Report generation degraded; showing fallback summary."}

    async def astream_events(self, state: TriageState):
        """Yield (node_name, state_update) tuples as the graph executes."""
        async for chunk in self.graph.astream(state, stream_mode="updates"):
            for node_name, update in chunk.items():
                yield node_name, update or {}
