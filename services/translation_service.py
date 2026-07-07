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
        try:
            from google import genai
            key = settings.gemini_api_key or settings.GEMINI_API_KEY or None
            if key:
                self.client = genai.Client(api_key=key)
                logger.info("Gemini Translate Client initialized successfully.")
        except Exception as e:
            logger.warning(
                f"Could not load Gemini client for TranslationService: {e}"
            )

    def _generate_content_with_fallback(self, prompt: str, task_weight: str = "light") -> str:
        """
        Attempts to generate content using multiple fallback models to spread the quota load.
        """
        models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash"]
            
        last_err = None
        for model in models_to_try:
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=prompt
                )
                return response.text.strip()
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "exhausted" in err_str.lower() or "quota" in err_str.lower() or "limit" in err_str.lower():
                    logger.warning(f"[TranslationService] Model {model} quota exhausted. Retrying with next model...")
                    last_err = e
                    continue
                else:
                    raise e
        raise last_err

    def _translate_free_web(self, text: str, sl: str, tl: str) -> str:
        """
        Zero-key public Google Translate web endpoint fallback.
        """
        import httpx
        try:
            url = "https://translate.googleapis.com/translate_a/single"
            params = {
                "client": "gtx",
                "sl": sl,
                "tl": tl,
                "dt": "t",
                "q": text
            }
            resp = httpx.get(url, params=params, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                return "".join([part[0] for part in data[0] if part[0]])
        except Exception as e:
            logger.error(f"[TranslationService] Free web translate failed: {e}")
        return text

    def _detect_free_web(self, text: str) -> str:
        """
        Zero-key language detection fallback using public translate API.
        """
        import httpx
        try:
            url = "https://translate.googleapis.com/translate_a/single"
            params = {
                "client": "gtx",
                "sl": "auto",
                "tl": "en",
                "dt": "t",
                "q": text
            }
            resp = httpx.get(url, params=params, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                if len(data) >= 3 and isinstance(data[2], str):
                    code = data[2]
                    logger.info(f"Free Web detected language: {code}")
                    return code
        except Exception as e:
            logger.error(f"[TranslationService] Free web detect failed: {e}")
        return "hi"

    # ─── Language Detection ───────────────────────────────────────────────────

    def detect_language(self, text: str) -> str:
        """
        Detects the language of the given text.
        Returns an ISO 639-1 language code (e.g. 'hi', 'te').
        """
        if self.client:
            try:
                prompt = (
                    "You are a language detection engine. Detect the language of the following text. "
                    "Respond with ONLY the two-letter ISO 639-1 language code of the language "
                    "(e.g., 'hi' for Hindi, 'te' for Telugu, 'ta' for Tamil, 'en' for English, 'kn' for Kannada, 'bn' for Bengali, 'mr' for Marathi, 'gu' for Gujarati, 'pa' for Punjabi, 'or' for Odia, 'ml' for Malayalam). "
                    "Do not include any explanation or extra text.\n\n"
                    f"Text: \"{text}\""
                )
                detected = self._generate_content_with_fallback(prompt, task_weight="light").lower()
                if len(detected) >= 2:
                    code = detected[:2]
                    if code in SUPPORTED_LANGUAGES:
                        logger.info(f"Gemini detected language: {code}")
                        return code
                return detected
            except Exception as e:
                logger.error(f"Gemini language detection failed: {e}. Falling back to free web detection.")
                return self._detect_free_web(text)
        
        # Heuristic fallback: detect script to guess language
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

    # ─── Gemini Translate (primary) ────────────────────────────────────

    def translate_to_english(self, text: str, source_language: str = "hi") -> str:
        """
        Translates text from a local Indic language to English.
        """
        if self.client:
            try:
                logger.info(f"Translating '{text[:60]}...' from '{source_language}' → 'en'")
                prompt = (
                    f"Translate the following text from {SUPPORTED_LANGUAGES.get(source_language, source_language)} to English. "
                    "Provide ONLY the plain translated text. Do not include quotes, introductory phrases, or explanations.\n\n"
                    f"Text: \"{text}\""
                )
                translated_text = self._generate_content_with_fallback(prompt, task_weight="light")
                logger.info(f"Translation result: {translated_text}")
                return translated_text
            except Exception as e:
                logger.error(f"Error during Gemini Translate → EN: {e}. Falling back to free web translation.")
                return self._translate_free_web(text, source_language, "en")
        else:
            return self._translate_free_web(text, source_language, "en")

    def translate_from_english(self, text: str, target_language: str = "hi") -> str:
        """
        Translates text from English to the target Indic language.
        """
        if self.client:
            try:
                logger.info(f"Translating '{text[:60]}...' from 'en' → '{target_language}'")
                prompt = (
                    f"Translate the following English text to {SUPPORTED_LANGUAGES.get(target_language, target_language)}. "
                    "Provide ONLY the plain translated text in the native script. Do not include English transliteration, quotes, or explanations.\n\n"
                    f"Text: \"{text}\""
                )
                translated_text = self._generate_content_with_fallback(prompt, task_weight="light")
                logger.info(f"Translation result: {translated_text}")
                return translated_text
            except Exception as e:
                logger.error(f"Error during Gemini Translate EN → {target_language}: {e}. Falling back to free web translation.")
                return self._translate_free_web(text, "en", target_language)
        else:
            return self._translate_free_web(text, "en", target_language)

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

    def translate_diagnosis_result(self, disease_name: str, actionable_steps: List[str], target_language: str) -> tuple[str, List[str]]:
        """
        Translates both the disease name and actionable steps list to the target language in a single Gemini call to save quota.
        """
        from typing import List
        if not self.client:
            return disease_name, actionable_steps
            
        try:
            target_lang_name = SUPPORTED_LANGUAGES.get(target_language, target_language)
            logger.info(f"Batch translating diagnosis results to {target_lang_name} using Gemini")
            
            steps_joined = "\n".join([f"- {step}" for step in actionable_steps])
            prompt = (
                f"You are a professional translator. Translate the following crop disease details into {target_lang_name}.\n"
                "Output the result strictly in the following format with '---' separating the translated disease name and the translated actionable steps:\n"
                "[Translated Disease Name]\n"
                "---\n"
                "[Translated Step 1]\n"
                "[Translated Step 2]\n"
                "...\n\n"
                "Details to translate:\n"
                f"Disease Name: {disease_name}\n"
                "Actionable Steps:\n"
                f"{steps_joined}"
            )
            
            translated_text = self._generate_content_with_fallback(prompt)
            
            content = translated_text.strip()
            parts = content.split("---")
            if len(parts) >= 2:
                translated_name = parts[0].strip()
                translated_steps_text = parts[1].strip()
                # Parse steps
                translated_steps = []
                for line in translated_steps_text.split("\n"):
                    line = line.strip()
                    if line.startswith("-") or line.startswith("*"):
                        line = line[1:].strip()
                    if line:
                        translated_steps.append(line)
                return translated_name, translated_steps
            else:
                return disease_name, actionable_steps
        except Exception as e:
            logger.error(f"Error in batch translation: {e}. Falling back to individual free web translations.")
            try:
                translated_name = self._translate_free_web(disease_name, "en", target_language)
                translated_steps = [
                    self._translate_free_web(step, "en", target_language)
                    for step in actionable_steps
                ]
                return translated_name, translated_steps
            except Exception as web_err:
                logger.error(f"Free web fallback inside batch translate failed: {web_err}")
                return disease_name, actionable_steps
