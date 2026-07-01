import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from config import settings

logger = logging.getLogger("intent_parser")


# ─── Gemini Structured Output Schema ─────────────────────────────────────────

class IntentAnalysis(BaseModel):
    intent: str = Field(
        description=(
            "Primary intent category. One of: pest_alert, disease_alert, "
            "weather_inquiry, irrigation_issue, market_price_inquiry, "
            "fertilizer_advice, harvest_advice, general_advice."
        )
    )
    crop_type: str = Field(
        description="The crop type mentioned (e.g. rice, wheat, cotton, sugarcane, maize, tomato, onion, potato). Use 'unknown' if not mentioned."
    )
    location: str = Field(
        description="The district, state, or region mentioned. Use 'unknown' if not mentioned."
    )
    reported_problem: str = Field(
        description="Concise one-sentence summary of the farmer's core issue or question."
    )
    severity: str = Field(
        description="Estimated urgency level: 'low', 'medium', or 'high'. Base on language cues like 'completely destroyed', 'urgent', 'dying', etc."
    )
    advisory_type: str = Field(
        description=(
            "Type of advisory needed. One of: "
            "immediate_action, expert_review, monitoring, informational."
        )
    )
    confidence_score: float = Field(
        description="Confidence in the analysis from 0.0 to 1.0."
    )


# ─── Few-shot examples for the Gemini prompt ─────────────────────────────────

FEW_SHOT_EXAMPLES = """
Examples:

Input: "My wheat crop is completely destroyed by aphids in Ludhiana, Punjab. The plants are dying."
Output:
{
  "intent": "pest_alert",
  "crop_type": "wheat",
  "location": "Ludhiana, Punjab",
  "reported_problem": "Severe aphid infestation causing complete crop destruction.",
  "severity": "high",
  "advisory_type": "immediate_action",
  "confidence_score": 0.95
}

Input: "The leaves of my sugarcane are turning red. What should I do?"
Output:
{
  "intent": "disease_alert",
  "crop_type": "sugarcane",
  "location": "unknown",
  "reported_problem": "Leaves turning red, possibly indicating a nutrient deficiency or disease.",
  "severity": "medium",
  "advisory_type": "expert_review",
  "confidence_score": 0.82
}

Input: "When is the best time to irrigate my tomato plants?"
Output:
{
  "intent": "irrigation_issue",
  "crop_type": "tomato",
  "location": "unknown",
  "reported_problem": "Farmer seeking guidance on optimal irrigation timing for tomatoes.",
  "severity": "low",
  "advisory_type": "informational",
  "confidence_score": 0.90
}
"""

SYSTEM_INSTRUCTION = (
    "You are an expert agricultural analyst AI for rural India. "
    "A farmer has submitted a voice complaint that has been transcribed and translated to English. "
    "Carefully analyze the text and extract structured information. "
    "Be conservative with severity — only mark 'high' for urgent crop-loss situations."
)


# ─── Mock heuristics ─────────────────────────────────────────────────────────

CROP_KEYWORDS = {
    "rice": ["rice", "paddy", "dhaan", "dhan"],
    "wheat": ["wheat", "gehun", "gehu"],
    "cotton": ["cotton", "kapas"],
    "sugarcane": ["sugarcane", "ganna"],
    "maize": ["maize", "corn", "makka", "bhutta"],
    "tomato": ["tomato", "tamatar"],
    "onion": ["onion", "pyaz"],
    "potato": ["potato", "aloo"],
    "soybean": ["soybean", "soya"],
}

SEVERITY_HIGH_KEYWORDS = [
    "destroyed", "dying", "completely", "urgent", "severe", "emergency",
    "total loss", "all dead", "burning", "collapsed",
]

SEVERITY_MEDIUM_KEYWORDS = [
    "yellow", "wilting", "spreading", "many", "lots of", "infestation",
    "disease", "brown spots", "rotting",
]

INTENT_KEYWORDS = {
    "pest_alert": ["pest", "insect", "bug", "worm", "aphid", "locust", "whitefly"],
    "disease_alert": ["disease", "fungus", "blight", "rot", "rust", "mold", "virus"],
    "weather_inquiry": ["rain", "drought", "flood", "temperature", "heat", "cold", "hail"],
    "irrigation_issue": ["irrigation", "water", "drought", "dry", "pump", "canal"],
    "market_price_inquiry": ["price", "market", "sell", "mandi", "rate", "cost"],
    "fertilizer_advice": ["fertilizer", "urea", "manure", "nutrient", "npk", "dap"],
    "harvest_advice": ["harvest", "reap", "cut", "ready", "yield", "sow", "plant"],
}


def _mock_parse(text: str) -> Dict[str, Any]:
    """Heuristic-based mock parsing for development/testing."""
    lower = text.lower()

    # Detect crop
    crop = "rice"  # default
    for crop_name, keywords in CROP_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            crop = crop_name
            break

    # Detect intent
    intent = "general_advice"  # default
    for intent_name, keywords in INTENT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            intent = intent_name
            break

    # Detect severity
    severity = "low"
    if any(kw in lower for kw in SEVERITY_HIGH_KEYWORDS):
        severity = "high"
    elif any(kw in lower for kw in SEVERITY_MEDIUM_KEYWORDS):
        severity = "medium"

    # Advisory type based on severity
    advisory_map = {
        "high": "immediate_action",
        "medium": "expert_review",
        "low": "informational",
    }
    advisory_type = advisory_map[severity]

    # Simple location detection (look for "in <word>")
    location = "unknown"
    words = text.split()
    for i, word in enumerate(words):
        if word.lower() == "in" and i + 1 < len(words):
            candidate = words[i + 1].strip(".,;!?")
            if candidate[0].isupper():
                location = candidate
                break

    return {
        "intent": intent,
        "crop_type": crop,
        "location": location,
        "reported_problem": f"{intent.replace('_', ' ').title()} detected on {crop} crop.",
        "severity": severity,
        "advisory_type": advisory_type,
        "confidence_score": 0.70,
    }


# ─── Intent Parser Service ────────────────────────────────────────────────────

class IntentParser:
    def __init__(self):
        self.client = None
        if not settings.MOCK_GCP_APIS and settings.GEMINI_API_KEY:
            try:
                from google import genai
                self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
                logger.info("Real GenAI Client initialized successfully.")
            except Exception as e:
                logger.warning(
                    f"Could not load google-genai client: {e}. Mock parser will be used."
                )
        else:
            logger.info("IntentParser initialized in mock mode.")

    async def parse_intent(self, english_transcript: str) -> Dict[str, Any]:
        """
        Parses the English transcript using Gemini 1.5 Flash structured output.
        Falls back to heuristic mock parsing if Gemini is unavailable.

        Args:
            english_transcript: English text to analyze.

        Returns:
            Dictionary with keys: intent, crop_type, location, reported_problem,
            severity, advisory_type, confidence_score.
        """
        if self.client and not settings.MOCK_GCP_APIS:
            try:
                logger.info("Sending Gemini 1.5 Flash structured output request...")

                prompt = (
                    f"{FEW_SHOT_EXAMPLES}\n\n"
                    f"Now analyze this farmer query:\n"
                    f'Input: "{english_transcript}"\n'
                    f"Output:"
                )

                response = self.client.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=prompt,
                    config={
                        "system_instruction": SYSTEM_INSTRUCTION,
                        "response_mime_type": "application/json",
                        "response_schema": IntentAnalysis,
                    },
                )

                text = response.text
                logger.info(f"Gemini raw response: {text}")

                import json
                parsed_data = json.loads(text)
                return parsed_data

            except Exception as e:
                logger.error(
                    f"Gemini structured parsing failed: {e}. Falling back to mock."
                )
                return _mock_parse(english_transcript)
        else:
            logger.info(f"[Mock Gemini] Parsing intent for: '{english_transcript[:80]}...'")
            return _mock_parse(english_transcript)
