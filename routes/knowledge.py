from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict
from services.knowledge_service import KnowledgeService

router = APIRouter(prefix="/api/v1/knowledge", tags=["Agricultural RAG Knowledge Base"])

class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="Query phrase or farmer concern. E.g. 'How to cure tomato blight?'")
    top_k: int = Field(2, description="Number of relevant document snippets to retrieve")

class RAGSnippet(BaseModel):
    doc_id: str = Field(..., description="Seeded document ID reference")
    title: str = Field(..., description="Document title")
    text: str = Field(..., description="Document matching snippet text")
    similarity: float = Field(..., description="Cosine similarity confidence score")

class RAGQueryResponse(BaseModel):
    query: str = Field(..., description="Echoed input search query")
    relevant_passages: List[RAGSnippet] = Field(..., description="Sorted list of retrieved snippets")

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
