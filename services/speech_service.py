import logging
from config import settings

logger = logging.getLogger("speech_service")

# BCP-47 language codes supported by Google Cloud Speech-to-Text
SUPPORTED_LANGUAGES = {
    "hi-IN": "Hindi",
    "te-IN": "Telugu",
    "ta-IN": "Tamil",
    "kn-IN": "Kannada",
    "bn-IN": "Bengali",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "pa-IN": "Punjabi",
    "en-IN": "English (India)",
    "en-US": "English (US)",
}

# Mock transcripts for demo/testing mode
MOCK_TRANSCRIPTS = {
    "hi-IN": "मेरी धान की फसल में कीड़े लग गए हैं और पत्तियां पीली पड़ रही हैं।",
    "te-IN": "నా వరి పంటలో తెగుళ్లు వచ్చాయి మరియు ఆకులు పసుపు రంగులోకి మారుతున్నాయి.",
    "ta-IN": "என் நெல் பயிரில் பூச்சிகள் தாக்கி இலைகள் மஞ்சளாக மாறுகின்றன.",
    "kn-IN": "ನನ್ನ ಭತ್ತದ ಬೆಳೆಯಲ್ಲಿ ಕೀಟಗಳ ದಾಳಿಯಾಗಿದ್ದು ಎಲೆಗಳು ಹಳದಿಯಾಗುತ್ತಿವೆ.",
    "bn-IN": "আমার ধানের ফসলে পোকামাকড় আক্রমণ করেছে এবং পাতা হলুদ হয়ে যাচ্ছে।",
    "mr-IN": "माझ्या भाताच्या पिकावर कीड लागली आहे आणि पाने पिवळी पडत आहेत.",
    "gu-IN": "મારા ડાંગરના પાકમાં જંતુઓ આવ્યા છે અને પાંદડા પીળા પડી રહ્યા છે.",
    "pa-IN": "ਮੇਰੀ ਝੋਨੇ ਦੀ ਫਸਲ ਵਿੱਚ ਕੀੜੇ ਲੱਗ ਗਏ ਹਨ ਅਤੇ ਪੱਤੇ ਪੀਲੇ ਪੈ ਰਹੇ ਹਨ।",
    "en-IN": "My rice crop has been attacked by pests and the leaves are turning yellow.",
    "en-US": "My rice crop has been attacked by pests and the leaves are turning yellow.",
}


class SpeechService:
    def __init__(self):
        self.client = None
        if not settings.MOCK_GCP_APIS:
            try:
                from google.cloud import speech
                self.client = speech.SpeechAsyncClient()
                logger.info("Real SpeechAsyncClient initialized successfully.")
            except Exception as e:
                logger.warning(
                    f"Could not load Google Cloud Speech client: {e}. Mock will be used."
                )

    def _detect_audio_encoding(self, audio_bytes: bytes):
        """
        Detects audio encoding from magic bytes at the start of the file.
        Returns a tuple of (encoding_enum, sample_rate_hertz).
        """
        try:
            from google.cloud import speech
        except ImportError:
            return None, 16000

        # FLAC: starts with 'fLaC'
        if audio_bytes[:4] == b"fLaC":
            return speech.RecognitionConfig.AudioEncoding.FLAC, 16000

        # OGG/Opus: starts with 'OggS'
        if audio_bytes[:4] == b"OggS":
            return speech.RecognitionConfig.AudioEncoding.OGG_OPUS, 48000

        # WAV/PCM: starts with 'RIFF'
        if audio_bytes[:4] == b"RIFF":
            # Extract sample rate from WAV header (bytes 24-27, little-endian)
            if len(audio_bytes) >= 28:
                import struct
                sample_rate = struct.unpack_from("<I", audio_bytes, 24)[0]
                return speech.RecognitionConfig.AudioEncoding.LINEAR16, sample_rate
            return speech.RecognitionConfig.AudioEncoding.LINEAR16, 16000

        # Default: assume LINEAR16 at 16kHz
        return speech.RecognitionConfig.AudioEncoding.LINEAR16, 16000

    async def transcribe_audio(
        self, audio_bytes: bytes, language_code: str = "hi-IN"
    ) -> str:
        """
        Transcribes audio bytes into text.
        Args:
            audio_bytes: Raw audio content (WAV / FLAC / OGG-Opus).
            language_code: BCP-47 language tag (e.g. "hi-IN", "te-IN", "ta-IN").
        Returns:
            Transcribed text string.
        """
        if language_code not in SUPPORTED_LANGUAGES:
            logger.warning(
                f"Language code '{language_code}' not in known list. Proceeding anyway."
            )

        if self.client and not settings.MOCK_GCP_APIS:
            try:
                from google.cloud import speech

                encoding, sample_rate = self._detect_audio_encoding(audio_bytes)

                config = speech.RecognitionConfig(
                    encoding=encoding,
                    sample_rate_hertz=sample_rate,
                    language_code=language_code,
                    # Enable automatic punctuation for cleaner transcripts
                    enable_automatic_punctuation=True,
                )
                audio = speech.RecognitionAudio(content=audio_bytes)

                logger.info(
                    f"Sending STT request | lang={language_code} | "
                    f"encoding={encoding} | sample_rate={sample_rate}"
                )
                response = await self.client.recognize(config=config, audio=audio)

                transcript_parts = [
                    result.alternatives[0].transcript for result in response.results
                ]
                full_transcript = " ".join(transcript_parts)
                logger.info(f"STT complete: {full_transcript}")
                return full_transcript

            except Exception as e:
                logger.error(f"Error during Speech-to-Text call: {e}")
                raise e
        else:
            # Mock mode
            logger.info(
                f"[Mock STT] Simulating transcription for {len(audio_bytes)} bytes "
                f"in language: {language_code}"
            )
            return MOCK_TRANSCRIPTS.get(
                language_code,
                MOCK_TRANSCRIPTS["hi-IN"],  # default to Hindi mock
            )
