"""
Model utilities for AyuMitraAI.
Provides a fallback chain for Gemini model calls to handle quota (503) errors.
"""

import asyncio
import logging

logger = logging.getLogger("ayumitra.model_utils")

# Ordered fallback chain — tries primary first, falls back on 503/quota errors
GEMINI_FALLBACK_CHAIN = [
    "gemini-3.5-flash",      # Primary: near-Pro intelligence, Flash speed
    "gemini-2.5-flash",      # Fallback 1: fast + capable
    "gemini-3.1-flash-lite", # Fallback 2: most cost-efficient
]


async def generate_with_fallback(client, contents: str, **kwargs) -> str:
    """
    Try generating content with each model in GEMINI_FALLBACK_CHAIN until one succeeds.
    Raises the last exception if all models fail.
    """
    last_exc = None
    for model in GEMINI_FALLBACK_CHAIN:
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=model,
                contents=contents,
                **kwargs,
            )
            if model != GEMINI_FALLBACK_CHAIN[0]:
                logger.info("Used fallback model %s (primary unavailable)", model)
            return response.text
        except Exception as e:
            err_str = str(e)
            # Only continue to fallback on quota/overload/rate-limit errors
            if any(code in err_str for code in ["503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED", "quota", "overloaded"]):
                logger.warning("Model %s unavailable (%s), trying next...", model, err_str[:80])
                last_exc = e
                continue
            # For other errors (400, 404, invalid arg), don't bother falling back
            raise
    raise last_exc
