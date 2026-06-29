"""
Qdrant Vector DB Service for AyuMitraAI
Stores and retrieves prescription embeddings for RAG-based context in future sessions.

Collection: ayumitra_prescriptions
Embedding: Google Gemini text-embedding-004 (768-dim) via the genai client
Fallback: If QDRANT_URL is not configured, all operations silently skip.
"""

import logging
import os
import sys
import asyncio
from typing import List, Optional, Dict, Any

sys.path.append(os.path.dirname(__file__))
from config import get_settings

logger = logging.getLogger("ayumitra.qdrant")
settings = get_settings()

COLLECTION_NAME = "ayumitra_prescriptions"
EMBEDDING_MODEL = "models/gemini-embedding-2"
EMBEDDING_DIM = 3072

_qdrant_client = None
_genai_client = None


def _get_clients():
    global _qdrant_client, _genai_client
    if not settings.QDRANT_URL:
        return None, None
    if _qdrant_client is None:
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import Distance, VectorParams
            from google import genai

            _qdrant_client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY or None,
            )
            _genai_client = genai.Client()

            # Ensure collection exists
            existing = [c.name for c in _qdrant_client.get_collections().collections]
            if COLLECTION_NAME not in existing:
                _qdrant_client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
                )
                logger.info("Created Qdrant collection: %s", COLLECTION_NAME)
        except Exception as e:
            logger.warning("Qdrant init failed: %s", e)
            _qdrant_client = None
            _genai_client = None

    return _qdrant_client, _genai_client


def _embed(text: str) -> Optional[List[float]]:
    """Embed text using Gemini text-embedding-004."""
    _, genai_client = _get_clients()
    if genai_client is None:
        return None
    try:
        result = genai_client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
        )
        return result.embeddings[0].values
    except Exception as e:
        logger.warning("Embedding failed: %s", e)
        return None


async def store_prescription(
    prescription_id: str,
    patient_id: str,
    patient_name: str,
    doctor_name: str,
    specialty: str,
    symptoms: str,
    notes: str,
    medications: List[Dict[str, Any]],
) -> bool:
    """
    Embed the full prescription text and store in Qdrant.
    Returns True if successfully stored, False if Qdrant not configured or failed.
    """
    client, _ = _get_clients()
    if client is None:
        logger.warning("Qdrant not configured — skipping prescription storage")
        return False

    full_text = (
        f"Patient: {patient_name}\n"
        f"Doctor: {doctor_name} ({specialty})\n"
        f"Symptoms: {symptoms}\n"
        f"Medications: {', '.join(m.get('name', '') for m in medications)}\n"
        f"Notes: {notes}"
    )

    vector = await asyncio.to_thread(_embed, full_text)
    if vector is None:
        return False

    try:
        from qdrant_client.models import PointStruct
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                PointStruct(
                    id=prescription_id,
                    vector=vector,
                    payload={
                        "prescription_id": prescription_id,
                        "patient_id": patient_id,
                        "patient_name": patient_name,
                        "doctor_name": doctor_name,
                        "specialty": specialty,
                        "symptoms": symptoms,
                        "notes": notes,
                        "medications": medications,
                    },
                )
            ],
        )
        logger.info("Stored prescription %s in Qdrant", prescription_id)
        return True
    except Exception as e:
        logger.error("Qdrant upsert failed: %s", e)
        return False


async def search_similar_prescriptions(
    query_text: str, patient_id: Optional[str] = None, top_k: int = 3
) -> List[Dict[str, Any]]:
    """
    Search Qdrant for similar past prescriptions.
    Optionally filter by patient_id so patients only see their own history.
    Returns list of prescription payloads.
    """
    client, _ = _get_clients()
    if client is None:
        return []

    vector = await asyncio.to_thread(_embed, query_text)
    if vector is None:
        return []

    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        query_filter = None
        if patient_id:
            query_filter = Filter(
                must=[FieldCondition(key="patient_id", match=MatchValue(value=patient_id))]
            )

        results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=vector,
            query_filter=query_filter,
            limit=top_k,
            with_payload=True,
        )
        return [r.payload for r in results]
    except Exception as e:
        logger.error("Qdrant search failed: %s", e)
        return []
