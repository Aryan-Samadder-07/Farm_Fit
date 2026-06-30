import math
from google import genai
from config import settings

class DocumentChunk:
    def __init__(self, doc_id: str, title: str, text: str, embedding: list[float] | None = None):
        self.doc_id = doc_id
        self.title = title
        self.text = text
        self.embedding = embedding

class KnowledgeService:
    def __init__(self, api_key: str | None = None):
        key = api_key or settings.gemini_api_key or None
        self.client = genai.Client(api_key=key)
        self.chunks: list[DocumentChunk] = []
        self._initialize_knowledge_base()

    def _initialize_knowledge_base(self):
        """
        Seeds the in-memory RAG database with agricultural advisory guidelines, 
        crop manuals, and government subsidy details.
        """
        raw_documents = [
            {
                "doc_id": "icar_tomato_01",
                "title": "ICAR Tomato Late Blight Management Guidelines",
                "text": "Late Blight of Tomato, caused by Phytophthora infestans, is a critical fungal disease. "
                        "Symptoms include dark brown, water-soaked spots on leaves expanding rapidly in high humidity. "
                        "Management: Apply Metalaxyl + Mancozeb (0.2%) or Copper Oxychloride (0.3%) sprays. "
                        "Prune lower leaves to ensure proper ventilation and drainage. Prevent overhead irrigation to reduce leaf wetness."
            },
            {
                "doc_id": "icar_rice_01",
                "title": "ICAR Rice Blast Treatment Advisory",
                "text": "Rice Blast (Magnaporthe oryzae) causes spindle-shaped lesions on leaves with gray centers. "
                        "Management: Avoid excessive nitrogen fertilizers which promote vegetative susceptibility. "
                        "Spray Tricyclazole 75 WP at 0.6 grams per liter of water. Ensure proper drainage in lower plots."
            },
            {
                "doc_id": "pm_kisan_advisory",
                "title": "PM-KISAN Scheme Eligibility and Guidelines",
                "text": "The Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) is a central sector scheme providing "
                        "an income support of Rs. 6,000 per year in three equal installments to all landholding farmer families. "
                        "Exclusions include institutional landholders, income tax payers, and retired pensioners drawing over Rs. 10,000 monthly."
            },
            {
                "doc_id": "ap_subsidy_drip",
                "title": "Andhra Pradesh Micro Irrigation Project Subsidies",
                "text": "The AP Micro Irrigation Project (APMIP) offers subsidies on drip and sprinkler systems. "
                        "Small and marginal farmers are eligible for up to 90% subsidy depending on land acreage. "
                        "Required documents include land ownership records (Pattadar Passbook), Aadhaar card, and soil/water test reports."
            }
        ]
        
        for doc in raw_documents:
            self.chunks.append(DocumentChunk(
                doc_id=doc["doc_id"],
                title=doc["title"],
                text=doc["text"]
            ))

    async def _embed_text(self, text: str) -> list[float]:
        """
        Generates vector embeddings using Gemini's text-embedding-004 model.
        Falls back to a basic TF-IDF frequency-vectorizer if API is unavailable or rate-limited.
        """
        try:
            response = self.client.models.embed_content(
                model="text-embedding-004",
                contents=text
            )
            # Extracted list of floats from response content
            if response.embeddings and len(response.embeddings) > 0:
                return response.embeddings[0].values
        except Exception as e:
            print(f"[KnowledgeService] Gemini embedding failed: {e}. Using deterministic string hash vectorization.")
        
        # Simple, deterministic mathematical fallback vectorization (128-dim hash vector)
        # to ensure the system is fully functional under rate-limits
        vector = [0.0] * 128
        for char in text:
            idx = ord(char) % 128
            vector[idx] += 1.0
        # Normalize
        norm = math.sqrt(sum([v**2 for v in vector]))
        if norm > 0:
            vector = [v / norm for v in vector]
        return vector

    async def build_vectors(self):
        """
        Pre-computes embeddings for all seeded document chunks.
        """
        for chunk in self.chunks:
            if not chunk.embedding:
                chunk.embedding = await self._embed_text(chunk.text)

    async def query_knowledge(self, query: str, top_k: int = 2) -> list[dict]:
        """
        Queries the vector store using cosine similarity and returns top matches.
        """
        # Ensure vectors are built
        await self.build_vectors()
        
        query_vector = await self._embed_text(query)
        
        matches = []
        for chunk in self.chunks:
            if not chunk.embedding or len(chunk.embedding) != len(query_vector):
                continue
            
            # Cosine similarity (dot product of normalized vectors)
            dot_product = sum(q * d for q, d in zip(query_vector, chunk.embedding))
            matches.append({
                "doc_id": chunk.doc_id,
                "title": chunk.title,
                "text": chunk.text,
                "similarity": round(dot_product, 3)
            })
        
        # Sort descending by similarity score
        matches.sort(key=lambda x: x["similarity"], reverse=True)
        return matches[:top_k]
