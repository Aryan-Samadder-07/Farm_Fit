from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from services.knowledge_service import KnowledgeService
from services.speech_service import SpeechService
from services.translation_service import TranslationService

router = APIRouter(prefix="/api/v1/knowledge", tags=["Agricultural RAG Knowledge Base"])

class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="Query phrase or farmer concern. E.g. 'How to cure tomato blight?'")
    top_k: int = Field(5, description="Number of relevant document snippets to retrieve")

class RAGSnippet(BaseModel):
    doc_id: str = Field(..., description="Seeded document ID reference")
    title: str = Field(..., description="Document title")
    text: str = Field(..., description="Document matching snippet text")
    similarity: float = Field(..., description="Cosine similarity confidence score")
    category: str = Field("general", description="Document category")

class RAGQueryResponse(BaseModel):
    query: str = Field(..., description="Echoed input search query")
    relevant_passages: List[RAGSnippet] = Field(..., description="Sorted list of retrieved snippets")


# ── New dual-layer search models ──────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(..., description="Search query in English")
    top_k: int = Field(5, description="Number of local corpus results to return")

class WebSource(BaseModel):
    title: str
    url: str
    snippet: str = ""

class LocalPassage(BaseModel):
    doc_id: str
    title: str
    text: str
    category: str = "general"
    similarity: float

class SearchResponse(BaseModel):
    query: str
    answer: str = Field(..., description="AI-synthesized answer from web grounding")
    web_sources: List[WebSource] = Field(default_factory=list)
    local_passages: List[LocalPassage] = Field(default_factory=list)


@router.post("/query", response_model=RAGQueryResponse)
async def query_agriculture_knowledge(payload: RAGQueryRequest):
    try:
        service = KnowledgeService()
        matches = await service.query_knowledge(payload.query, payload.top_k)
        return {
            "query": payload.query,
            "relevant_passages": matches
        }
    except Exception as e:
        print(f"Error in query_agriculture_knowledge: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Knowledge retrieval RAG failed: {str(e)}"
        )


@router.post("/search", response_model=SearchResponse)
async def dual_layer_search(payload: SearchRequest):
    """
    Dual-layer universal search engine:
    - Layer 1: Gemini 2.0 Flash + Google Search grounding (live web, highest accuracy)
    - Layer 2: 25-document local corpus with Gemini embeddings + cosine similarity
    Both run concurrently and results are merged.
    """
    try:
        service = KnowledgeService()
        result = await service.search(payload.query, payload.top_k)
        return {
            "query": payload.query,
            "answer": result["answer"],
            "web_sources": result["web_sources"],
            "local_passages": result["local_passages"],
        }
    except Exception as e:
        print(f"Error in dual_layer_search: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.post("/query-preprocessed")
async def query_agriculture_knowledge_preprocessed(
    voice: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    language_code: str = Form("auto"),
    top_k: int = Form(2)
):
    """
    Preprocessed RAG Search query. Accepts voice or text in any language,
    detects language, translates to English, queries the knowledge base,
    and translates the results back to the farmer's native language.
    """
    speech_service = SpeechService()
    translation_service = TranslationService()

    try:
        raw_query = ""
        effective_lang = language_code

        if voice:
            audio_content = await voice.read()
            if audio_content:
                stt_lang = "hi-IN" if language_code == "auto" else language_code
                raw_query = await speech_service.transcribe_audio(
                    audio_bytes=audio_content, language_code=stt_lang
                )
                if language_code == "auto":
                    detected_prefix = translation_service.detect_language(raw_query)
                    effective_lang = f"{detected_prefix}-IN"
        elif text:
            raw_query = text
            if language_code == "auto":
                detected_prefix = translation_service.detect_language(raw_query)
                effective_lang = f"{detected_prefix}-IN"
        else:
            raise HTTPException(status_code=400, detail="Either voice or text query must be provided.")

        lang_prefix = effective_lang.split("-")[0]

        # Translate query to English for RAG querying
        english_query = raw_query
        if lang_prefix != "en":
            english_query = translation_service.translate_to_english(raw_query, source_language=lang_prefix)

        # Send English query to RAG Search API
        knowledge_srv = KnowledgeService()
        matches = await knowledge_srv.query_knowledge(english_query, top_k)

        # Translate the resulting snippets back to farmer's language
        translated_matches = []
        for match in matches:
            text_to_translate = match["text"]
            title_to_translate = match["title"]

            localized_text = text_to_translate
            localized_title = title_to_translate

            if lang_prefix != "en":
                localized_text = translation_service.translate_from_english(text_to_translate, target_language=lang_prefix)
                localized_title = translation_service.translate_from_english(title_to_translate, target_language=lang_prefix)

            translated_matches.append({
                "doc_id": match["doc_id"],
                "title": localized_title,
                "text": localized_text,
                "similarity": match["similarity"]
            })

        return {
            "original_query": raw_query,
            "english_query": english_query,
            "language_detected": effective_lang,
            "relevant_passages": translated_matches
        }

    except Exception as e:
        print(f"Error in query_agriculture_knowledge_preprocessed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preprocessed RAG query failed: {str(e)}"
        )


# ── Voice-to-Text + Translation endpoint ─────────────────────────────────────

class VoiceTextRequest(BaseModel):
    text: str = Field(..., description="Text in any language (local or English)")
    language_code: str = Field("auto", description="BCP-47 hint e.g. 'hi-IN'. Use 'auto' for auto-detection.")


@router.post("/voice-to-text")
async def voice_to_text_translate(payload: VoiceTextRequest):
    """
    Accepts text in any language, auto-detects or uses the provided language hint,
    translates to English, and returns both versions.
    Used by the RSK Dashboard voice input on the Ingestion (Review) and RAG Search pages.
    """
    translation_service = TranslationService()

    raw_text = payload.text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="text field must not be empty.")

    try:
        lang_code = payload.language_code
        if lang_code == "auto":
            detected = translation_service.detect_language(raw_text)
            lang_code = f"{detected}-IN"
        lang_prefix = lang_code.split("-")[0]

        # Translate to English (skip if already English)
        english_text = raw_text
        if lang_prefix != "en":
            english_text = translation_service.translate_to_english(raw_text, source_language=lang_prefix)

        return {
            "original_text":  raw_text,
            "english_text":   english_text,
            "language_detected": lang_code,
            "is_english": lang_prefix == "en",
        }
    except Exception as e:
        print(f"Error in voice_to_text_translate: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice-to-text translation failed: {str(e)}"
        )


# ── Translate English text to a local language ────────────────────────────────

class TranslateToLocalRequest(BaseModel):
    text: str = Field(..., description="English text to translate")
    target_language_code: str = Field(..., description="BCP-47 target language e.g. 'hi-IN'")


@router.post("/translate-to-local")
async def translate_to_local(payload: TranslateToLocalRequest):
    """
    Translates English text into the target local language.
    Used by the dashboard to translate Gemini AI responses back to the expert's selected language.
    """
    translation_service = TranslationService()

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text must not be empty.")

    lang_prefix = payload.target_language_code.split("-")[0]

    try:
        localized = text
        if lang_prefix != "en":
            localized = translation_service.translate_from_english(text, target_language=lang_prefix)

        return {
            "original_text": text,
            "localized_text": localized,
            "target_language": payload.target_language_code,
            "is_english": lang_prefix == "en",
        }
    except Exception as e:
        print(f"Error in translate_to_local: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Translation failed: {str(e)}"
        )
