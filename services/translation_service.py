import logging
import httpx
from config import settings

logger = logging.getLogger("translation_service")

# ─── Language coverage ────────────────────────────────────────────────────────

# ISO 639-1 → human-readable name
SUPPORTED_LANGUAGES = {
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "or": "Odia",
    "ml": "Malayalam",
    "en": "English",
}

# Mock English translations keyed by trigger keywords
_MOCK_TO_ENGLISH = [
    (["कीड़े", "कीट", "टिड्डी"],       "Pests have infested my rice crop and the leaves are turning yellow."),
    (["తెగుళ్లు", "పురుగులు"],           "Pests have attacked my paddy crop and the leaves are turning yellow."),
    (["பூச்சிகள்", "நோய்"],              "Insects are attacking my rice crop and leaves are turning yellow."),
    (["ಕೀಟಗಳ", "ರೋಗ"],                  "Pest attack on my paddy crop, leaves turning yellow."),
    (["পোকামাকড়", "রোগ"],               "Insects have infested my rice crop and leaves are turning yellow."),
    (["कीड", "रोग"],                     "Pest infestation on my crop, leaves are yellowing."),
    (["ਕੀੜੇ", "ਰੋਗ"],                   "Pests have attacked my wheat crop."),
    (["ਜੰਤੁ", "જંતુ"],                   "Insects are damaging my paddy crop."),
    (["सूखा", "पानी नहीं"],              "Drought conditions — my crops are drying up due to lack of water."),
    (["flood", "बाढ़", "వరద"],           "Flooding has damaged my fields."),
]

# Mock localized messages (English → local language)
_MOCK_FROM_ENGLISH = {
    "hi": "कृपया अपनी फसल पर नीम के तेल का छिड़काव करें।",
    "te": "దయచేసి మీ పంటపై వేప నూనెను పిచికారీ చేయండి.",
    "ta": "தயவுசெய்து உங்கள் பயிரில் வேப்பெண்ணெய் தெளிக்கவும்.",
    "kn": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಬೆಳೆಗೆ ಬೇವಿನ ಎಣ್ಣೆ ಸಿಂಪಡಿಸಿ.",
    "bn": "অনুগ্রহ করে আপনার ফসলে নিম তেল স্প্রে করুন।",
    "mr": "कृपया आपल्या पिकावर कडुनिंबाचे तेल फवारा.",
    "gu": "કૃપા કરીને તમારા પાક પર લીમડાનું તેલ છાંટો.",
    "pa": "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਫਸਲ 'ਤੇ ਨਿੰਮ ਦਾ ਤੇਲ ਛਿੜਕੋ।",
    "or": "ଦୟାକରି ଆପଣଙ୍କ ଫସଲରେ ନିମ ତେଲ ସ୍ପ୍ରେ କରନ୍ତୁ।",
    "ml": "ദയവായി നിങ്ങളുടെ വിളയിൽ വേപ്പ് എണ്ണ തളിക്കുക.",
}


class TranslationService:
    def __init__(self):
        self.client = None
        if not settings.MOCK_GCP_APIS:
            try:
                from google.cloud import translate_v2 as translate
                self.client = translate.Client()
                logger.info("Real Translate Client initialized successfully.")
            except Exception as e:
                logger.warning(
                    f"Could not load Google Cloud Translate client: {e}. Mock will be used."
                )

    # ─── Language Detection ───────────────────────────────────────────────────

    def detect_language(self, text: str) -> str:
        """
        Detects the language of the given text.
        Returns an ISO 639-1 language code (e.g. 'hi', 'te').
        Falls back to 'hi' (Hindi) in mock mode.
        """
        if self.client and not settings.MOCK_GCP_APIS:
            try:
                result = self.client.detect_language(text)
                lang = result.get("language", "hi")
                logger.info(f"Detected language: {lang} (confidence: {result.get('confidence', 'n/a')})")
                return lang
            except Exception as e:
                logger.error(f"Language detection failed: {e}")
                return "hi"
        else:
            # Heuristic: detect script to guess language
            if any("\u0900" <= c <= "\u097F" for c in text):
                return "hi"   # Devanagari → Hindi/Marathi
            if any("\u0C00" <= c <= "\u0C7F" for c in text):
                return "te"   # Telugu
            if any("\u0B80" <= c <= "\u0BFF" for c in text):
                return "ta"   # Tamil
            if any("\u0C80" <= c <= "\u0CFF" for c in text):
                return "kn"   # Kannada
            if any("\u0980" <= c <= "\u09FF" for c in text):
                return "bn"   # Bengali
            if any("\u0A00" <= c <= "\u0A7F" for c in text):
                return "pa"   # Punjabi (Gurmukhi)
            if any("\u0A80" <= c <= "\u0AFF" for c in text):
                return "gu"   # Gujarati
            if any("\u0D00" <= c <= "\u0D7F" for c in text):
                return "ml"   # Malayalam
            if any("\u0B00" <= c <= "\u0B7F" for c in text):
                return "or"   # Odia
            return "hi"

    # ─── Google Cloud Translate (primary) ────────────────────────────────────

    def translate_to_english(self, text: str, source_language: str = "hi") -> str:
        """
        Translates text from a local Indic language to English.
        """
        if self.client and not settings.MOCK_GCP_APIS:
            try:
                logger.info(f"Translating '{text[:60]}...' from '{source_language}' → 'en'")
                result = self.client.translate(
                    text, target_language="en", source_language=source_language
                )
                translated_text = result.get("translatedText", "")
                logger.info(f"Translation result: {translated_text}")
                return translated_text
            except Exception as e:
                logger.error(f"Error during Google Translate → EN: {e}")
                raise e
        else:
            logger.info(f"[Mock Translate] '{text[:60]}...' → English")
            for keywords, english_mock in _MOCK_TO_ENGLISH:
                if any(kw in text for kw in keywords):
                    return english_mock
            return f"My crop is facing issues and needs expert advice. [Original: {text[:80]}]"

    def translate_from_english(self, text: str, target_language: str = "hi") -> str:
        """
        Translates text from English to the target Indic language.
        """
        if self.client and not settings.MOCK_GCP_APIS:
            try:
                logger.info(f"Translating '{text[:60]}...' from 'en' → '{target_language}'")
                result = self.client.translate(
                    text, target_language=target_language, source_language="en"
                )
                translated_text = result.get("translatedText", "")
                logger.info(f"Translation result: {translated_text}")
                return translated_text
            except Exception as e:
                logger.error(f"Error during Google Translate EN → {target_language}: {e}")
                raise e
        else:
            logger.info(f"[Mock Translate] English → '{target_language}'")
            return _MOCK_FROM_ENGLISH.get(
                target_language,
                f"[Advisory in {SUPPORTED_LANGUAGES.get(target_language, target_language)}]: {text}",
            )

    # ─── Bhashini ULCA API wrapper ────────────────────────────────────────────

    async def translate_via_bhashini(
        self, text: str, source_language: str, target_language: str
    ) -> str:
        """
        Translates text via the Bhashini ULCA API.
        Requires BHASHINI_API_KEY and BHASHINI_PIPELINE_ID in settings.

        Reference: https://bhashini.gov.in/ulca/model/api
        """
        if not settings.BHASHINI_API_KEY or not settings.BHASHINI_PIPELINE_ID:
            logger.info(
                "[Bhashini] API key / pipeline ID not configured. Returning mock translation."
            )
            return self.translate_to_english(text, source_language) if target_language == "en" \
                else self.translate_from_english(text, target_language)

        url = "https://meity-auth.ulcacohort.org/ulca/apis/v0/model/compute"
        headers = {
            "Authorization": f"Bearer {settings.BHASHINI_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "pipelineId": settings.BHASHINI_PIPELINE_ID,
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": {
                        "language": {
                            "sourceLanguage": source_language,
                            "targetLanguage": target_language,
                        }
                    },
                }
            ],
            "inputData": {"input": [{"source": text}]},
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                translated = (
                    data["pipelineResponse"][0]["output"][0]["target"]
                )
                logger.info(f"[Bhashini] Translated: {translated[:80]}")
                return translated
        except Exception as e:
            logger.error(f"[Bhashini] API call failed: {e}. Falling back to Google Translate.")
            return self.translate_to_english(text, source_language) if target_language == "en" \
                else self.translate_from_english(text, target_language)

    # ─── Sarvam AI API wrapper ────────────────────────────────────────────────

    async def translate_via_sarvam(
        self, text: str, source_language: str, target_language: str
    ) -> str:
        """
        Translates text via the Sarvam AI Translate API.
        Requires SARVAM_API_KEY in settings.

        Reference: https://docs.sarvam.ai/api-reference-docs/translate
        """
        if not settings.SARVAM_API_KEY:
            logger.info(
                "[Sarvam] API key not configured. Returning mock translation."
            )
            return self.translate_to_english(text, source_language) if target_language == "en" \
                else self.translate_from_english(text, target_language)

        url = "https://api.sarvam.ai/translate"
        headers = {
            "api-subscription-key": settings.SARVAM_API_KEY,
            "Content-Type": "application/json",
        }
        payload = {
            "input": text,
            "source_language_code": f"{source_language}-IN" if "-" not in source_language else source_language,
            "target_language_code": f"{target_language}-IN" if "-" not in target_language else target_language,
            "speaker_gender": "Male",
            "mode": "formal",
            "model": "mayura:v1",
            "enable_preprocessing": True,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                translated = data.get("translated_text", "")
                logger.info(f"[Sarvam] Translated: {translated[:80]}")
                return translated
        except Exception as e:
            logger.error(f"[Sarvam] API call failed: {e}. Falling back to Google Translate.")
            return self.translate_to_english(text, source_language) if target_language == "en" \
                else self.translate_from_english(text, target_language)
