"""
Knowledge Service — Dual-Layer Agricultural Search Engine
=========================================================
Layer 1: Gemini 2.0 Flash with Google Search grounding (live web results, maximum accuracy)
Layer 2: Expanded 25-document local corpus with Gemini text-embedding-004 + cosine retrieval

Both layers run concurrently. Results are merged into a single structured response:
  - answer:         AI-synthesized paragraph from web grounding
  - web_sources:    list of web citations (title, url, snippet)
  - local_passages: top-k local corpus matches with similarity score
"""

import math
import asyncio
import logging
from google import genai
from google.genai import types as genai_types
from config import settings

logger = logging.getLogger(__name__)


# ── Document corpus ────────────────────────────────────────────────────────────

class DocumentChunk:
    def __init__(self, doc_id: str, title: str, text: str, category: str = "general"):
        self.doc_id = doc_id
        self.title = title
        self.text = text
        self.category = category
        self.embedding: list[float] | None = None


_CORPUS: list[dict] = [
    # ── Crop diseases ──────────────────────────────────────────────────────────
    {
        "doc_id": "icar_tomato_01",
        "title": "ICAR Tomato Late Blight Management",
        "category": "disease",
        "text": (
            "Late Blight of Tomato (Phytophthora infestans) causes dark brown, water-soaked lesions on leaves "
            "expanding rapidly in high humidity. Management: Apply Metalaxyl + Mancozeb (0.2%) or Copper "
            "Oxychloride (0.3%) sprays every 7 days during wet weather. Prune lower leaves for ventilation. "
            "Avoid overhead irrigation. Remove and destroy infected plant debris immediately."
        ),
    },
    {
        "doc_id": "icar_rice_01",
        "title": "ICAR Rice Blast Disease Advisory",
        "category": "disease",
        "text": (
            "Rice Blast (Magnaporthe oryzae) causes spindle-shaped lesions with gray centers on leaves and neck. "
            "Management: Avoid excessive nitrogen fertilizers. Spray Tricyclazole 75 WP at 0.6 g/L or "
            "Isoprothiolane 40 EC at 1.5 mL/L. Ensure proper field drainage. Use resistant varieties like "
            "Pusa Basmati 1121. Apply fungicide at tillering and booting stages."
        ),
    },
    {
        "doc_id": "icar_cotton_01",
        "title": "Cotton Bollworm Integrated Pest Management",
        "category": "pest",
        "text": (
            "Cotton Bollworm (Helicoverpa armigera) larvae bore into bolls reducing yield by 30–60%. "
            "Management: Set up pheromone traps (5/hectare) to monitor adult populations. Spray Emamectin "
            "Benzoate 5% SG at 0.4 g/L or Chlorantraniliprole 18.5 SC at 0.3 mL/L. Avoid broad-spectrum "
            "insecticides to preserve natural enemies. Practice crop rotation. Biological control using "
            "Helicoverpa NPV (250 LE/hectare) is highly effective."
        ),
    },
    {
        "doc_id": "icar_wheat_01",
        "title": "Wheat Yellow Rust Control Advisory",
        "category": "disease",
        "text": (
            "Yellow Rust (Puccinia striiformis) appears as yellow stripes on wheat leaves. Spreads rapidly "
            "in cool humid conditions (10–15°C). Management: Spray Propiconazole 25 EC at 0.1% at first sign "
            "of infection. Repeat after 15 days if disease pressure persists. Use resistant varieties like "
            "HD 2967, PBW 343. Sow timely — late sowing increases susceptibility."
        ),
    },
    {
        "doc_id": "icar_chilli_01",
        "title": "Chilli Leaf Curl Virus Management",
        "category": "disease",
        "text": (
            "Chilli Leaf Curl Virus (ChiLCV) is transmitted by whitefly (Bemisia tabaci). Symptoms include "
            "upward curling of leaves, stunting and mosaic patterns. Management: Control whitefly vector with "
            "Imidacloprid 17.8 SL (0.5 mL/L) or Thiamethoxam 25 WG (0.3 g/L). Remove infected plants. "
            "Use reflective mulches to repel whiteflies. Avoid planting near infected fields."
        ),
    },
    {
        "doc_id": "icar_maize_01",
        "title": "Fall Armyworm in Maize — ICAR Advisory",
        "category": "pest",
        "text": (
            "Fall Armyworm (Spodoptera frugiperda) is an invasive pest causing up to 73% yield loss in maize. "
            "Larvae feed on whorl leaves leaving characteristic 'window pane' damage. Management: Apply "
            "Emamectin Benzoate 5 SG (0.4 g/L), Chlorpyrifos 20 EC (2.5 mL/L) or Spinetoram 11.7 SC "
            "(0.5 mL/L) into the whorl. Release egg parasitoid Telenomus remus for biological control. "
            "Early warning through pheromone traps (5/ha). Report sightings to nearest Krishi Vigyan Kendra."
        ),
    },
    {
        "doc_id": "icar_banana_01",
        "title": "Banana Fusarium Wilt (Panama Disease) Management",
        "category": "disease",
        "text": (
            "Panama Disease (Fusarium oxysporum f.sp. cubense TR4) causes yellowing and wilting in banana. "
            "Soil-borne pathogen with no chemical cure. Management: Plant only disease-free tissue culture "
            "plantlets. Maintain field hygiene — disinfect tools with 70% alcohol or bleach. Avoid waterlogging. "
            "Destroy infected plants by uprooting and burning. Grow Cavendish varieties only in TR4-free areas."
        ),
    },
    # ── Government schemes ─────────────────────────────────────────────────────
    {
        "doc_id": "pm_kisan_01",
        "title": "PM-KISAN Scheme — Eligibility and Benefits",
        "category": "scheme",
        "text": (
            "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi) provides Rs 6,000/year in 3 installments of Rs 2,000 "
            "to all land-holding farmer families. Eligibility: Small and marginal farmers with cultivable land. "
            "Exclusions: Institutional landholders, income tax payers, retired pensioners above Rs 10,000/month, "
            "former/current constitutional post holders. Registration: pmkisan.gov.in or nearest CSC center. "
            "Required documents: Aadhaar, bank passbook, land records (Khatian/Patta)."
        ),
    },
    {
        "doc_id": "pmfby_01",
        "title": "PM Fasal Bima Yojana — Crop Insurance Scheme",
        "category": "scheme",
        "text": (
            "PM Fasal Bima Yojana (PMFBY) provides financial support to farmers suffering crop loss due to "
            "natural calamities, pests and diseases. Premium: 2% for Kharif crops, 1.5% for Rabi crops, 5% "
            "for horticulture/commercial crops — government pays the rest. Coverage: Prevented sowing, "
            "standing crop loss, post-harvest losses, and localized calamities. Register at pmfby.gov.in "
            "or through banks before the cutoff date. Claim settled via technology-based crop cutting experiments."
        ),
    },
    {
        "doc_id": "wb_schemes_01",
        "title": "West Bengal Agricultural Schemes and Subsidies",
        "category": "scheme",
        "text": (
            "West Bengal government provides multiple farming support schemes: "
            "(1) Bangla Krishi Sech Yojana: Free electricity for agricultural irrigation up to 6 HP pumps. "
            "(2) Krishak Bandhu: Rs 10,000/year income support per acre (min Rs 2,000) for farmers with land records. "
            "Accidental death benefit of Rs 2 lakh. (3) Matua Agricultural scheme: Special support for SC farmers. "
            "(4) Sabar Ghar scheme: Solar pumping for remote farms. Apply at Block Agriculture Office or wb.gov.in/agriculture."
        ),
    },
    {
        "doc_id": "ap_schemes_01",
        "title": "Andhra Pradesh Rytu Bharosa and Micro-Irrigation Schemes",
        "category": "scheme",
        "text": (
            "Andhra Pradesh provides: (1) YSR Rytu Bharosa: Rs 13,500/year input support per farmer family. "
            "(2) APMIP Micro Irrigation: Up to 90% subsidy on drip/sprinkler installation for small/marginal farmers. "
            "Required documents: Pattadar Passbook, Aadhaar, soil/water test reports. Apply at district agriculture office. "
            "(3) Jagananna Pasupu Kumkuma: Support for women farmer self-help groups. "
            "(4) Free borewell scheme for SC/ST farmers with landholding up to 5 acres."
        ),
    },
    {
        "doc_id": "kisan_credit_card_01",
        "title": "Kisan Credit Card (KCC) Scheme",
        "category": "scheme",
        "text": (
            "KCC provides farmers with affordable short-term credit for agricultural operations, maintenance "
            "of farm assets, consumption needs, allied activities and maintenance of post-harvest expenses. "
            "Interest rate: 7% per annum (effectively 4% with 3% interest subvention for timely repayment). "
            "Credit limit up to Rs 3 lakh without collateral. Eligible for all farmers, sharecroppers, oral lessees. "
            "Apply at any bank branch — required: land ownership or tenancy proof, identity proof, Aadhaar."
        ),
    },
    {
        "doc_id": "soil_health_card_01",
        "title": "Soil Health Card Scheme",
        "category": "scheme",
        "text": (
            "Soil Health Card (SHC) provides farmers with a report on their soil's nutrient status and fertilizer "
            "recommendations. Tests for 12 parameters: N, P, K, pH, EC, OC, S, Zn, Fe, Cu, Mn, B. "
            "Free of cost — visit nearest Krishi Vigyan Kendra or register at soilhealth.dac.gov.in. "
            "Card renewed every 2 years. Helps reduce fertilizer costs by 10–15% through precise recommendations."
        ),
    },
    # ── Soil & agronomy ────────────────────────────────────────────────────────
    {
        "doc_id": "soil_nitrogen_01",
        "title": "Nitrogen Deficiency in Crops — Identification and Treatment",
        "category": "soil",
        "text": (
            "Nitrogen deficiency causes yellowing (chlorosis) starting from older/lower leaves, stunted growth "
            "and pale green color. Crops most affected: rice, maize, wheat, vegetables. Treatment: "
            "Top-dress with Urea (46% N) at 20–30 kg/acre or apply 15-15-15 NPK fertilizer. "
            "For organic: apply well-decomposed FYM at 5 tonnes/acre or green manure (Dhaincha/Sesbania). "
            "Foliar spray with 2% urea solution gives quick response. Soil test recommended before application."
        ),
    },
    {
        "doc_id": "soil_ph_01",
        "title": "Soil pH Management — Acidic and Alkaline Soils",
        "category": "soil",
        "text": (
            "Optimal soil pH for most crops: 6.0–7.5. Acidic soils (pH < 6): Apply agricultural lime "
            "(CaCO3) at 2–4 tonnes/acre. Dolomite preferred for Mg-deficient soils. "
            "Alkaline soils (pH > 7.5): Apply gypsum (CaSO4) at 2–3 tonnes/acre plus organic matter. "
            "Grow acid-tolerant crops like tea (pH 4.5–6), potato (pH 5.0–6.5), blueberry. "
            "Saline soils: improve with drainage, gypsum, green manures. Test pH every 3 years."
        ),
    },
    {
        "doc_id": "drip_irrigation_01",
        "title": "Drip Irrigation — Setup, Benefits and Subsidies",
        "category": "agronomy",
        "text": (
            "Drip irrigation delivers water directly to root zone, saving 40–60% water vs. flood irrigation. "
            "Suitable for: fruits, vegetables, sugarcane, cotton. Components: mainline, sub-main, lateral, "
            "drippers (2–4 LPH), filter, pressure gauge. Cost: Rs 40,000–80,000/acre depending on crop. "
            "Government subsidy: 50–90% under PMKSY (Pradhan Mantri Krishi Sinchayee Yojana) for small/marginal "
            "farmers. Apply at district agriculture office. Also available via NABARD loans."
        ),
    },
    {
        "doc_id": "organic_farming_01",
        "title": "Organic Farming — Methods and Certification in India",
        "category": "agronomy",
        "text": (
            "Organic farming uses no synthetic fertilizers or pesticides. Key practices: "
            "(1) Vermicompost: worm-processed organic waste — apply 2 tonnes/acre. "
            "(2) Jeevamrutha: cow dung + cow urine fermented bio-stimulant for soil microbes. "
            "(3) Panchagavya: organic pest repellent and growth promoter. "
            "(4) Cover cropping with legumes (Dhaincha, Sunn hemp) for nitrogen fixation. "
            "Certification: NPOP (National Programme for Organic Production) via accredited body. "
            "Minimum 3-year conversion period. Markets: Jaivik Bharat, Amazon, direct export."
        ),
    },
    {
        "doc_id": "msp_prices_01",
        "title": "Minimum Support Price (MSP) for Major Crops 2024-25",
        "category": "market",
        "text": (
            "MSP rates declared by CACP for 2024-25 Kharif season: Paddy (common): Rs 2,300/quintal, "
            "Paddy (grade A): Rs 2,320/quintal, Jowar: Rs 3,371/quintal, Bajra: Rs 2,625/quintal, "
            "Maize: Rs 2,225/quintal, Tur/Arhar: Rs 7,550/quintal, Moong: Rs 8,682/quintal, "
            "Cotton (medium): Rs 7,121/quintal, Cotton (long): Rs 7,521/quintal, Groundnut: Rs 6,783/quintal. "
            "For Rabi 2024-25: Wheat: Rs 2,275/quintal, Gram: Rs 5,440/quintal, Lentil: Rs 6,425/quintal. "
            "Sell at MSP through FCI, NAFED or state procurement agencies."
        ),
    },
    {
        "doc_id": "natural_farming_01",
        "title": "Subhash Palekar Natural Farming (SPNF) Method",
        "category": "agronomy",
        "text": (
            "SPNF (Zero Budget Natural Farming) uses 4 elements: "
            "(1) Bijamrit: seed treatment with cow dung, cow urine, lime, soil — protects from seed/soil-borne diseases. "
            "(2) Jivamrit: fermenting 10 kg cow dung + 10 L cow urine + 2 kg jaggery + 2 kg chickpea flour in 200 L water "
            "for 48 hrs — activates soil microorganisms. Apply 200 L/acre monthly. "
            "(3) Mulching: keeps soil moist, controls weeds. "
            "(4) Waaphasa: maintaining 50% air + 50% moisture in soil pores. "
            "Promoted by Andhra Pradesh government as APCNF covering 8 lakh farmers."
        ),
    },
    {
        "doc_id": "ipm_general_01",
        "title": "Integrated Pest Management (IPM) Principles",
        "category": "pest",
        "text": (
            "IPM combines biological, cultural, mechanical and chemical controls to minimize pesticide use. "
            "Steps: (1) Monitoring: use pheromone traps, yellow sticky traps, field scouting weekly. "
            "(2) Threshold: spray only when pest population exceeds Economic Threshold Level (ETL). "
            "(3) Biological: release Trichogramma egg parasitoids, Chrysoperla predators, Bacillus thuringiensis. "
            "(4) Cultural: crop rotation, resistant varieties, border crops. "
            "(5) Chemical: last resort — use selective, low-persistence pesticides. "
            "Contact nearest Krishi Vigyan Kendra or state IPM cell for training."
        ),
    },
    {
        "doc_id": "post_harvest_01",
        "title": "Post-Harvest Management and Storage Best Practices",
        "category": "agronomy",
        "text": (
            "Post-harvest losses in India: 10–30% for fruits/vegetables, 6–10% for grains. "
            "Prevention: (1) Harvest at correct maturity — use refractometer for fruits. "
            "(2) Pre-cooling within 2 hrs of harvest. (3) Cold chain: 2–8°C for most vegetables, "
            "0–2°C for apples. (4) Grain storage: clean bins, maintain moisture <14%, use hermetic bags. "
            "(5) WDRA (Warehouse Development and Regulatory Authority) registered warehouses give pledge loans. "
            "Government scheme: Gramin Bhandaran Yojana provides 25% subsidy on rural storage construction."
        ),
    },
    {
        "doc_id": "e_nam_01",
        "title": "e-NAM — National Agricultural Market Online Trading",
        "category": "market",
        "text": (
            "e-NAM (enam.gov.in) is a pan-India electronic trading portal connecting 1,361 APMCs across 23 states. "
            "Benefits: transparent price discovery, online bidding, reduced middlemen, better income for farmers. "
            "How to register: visit nearest APMC/mandi with Aadhaar, bank account, land record. "
            "Commodities traded: over 200 including grains, oilseeds, spices, vegetables, fibres. "
            "Payment: direct bank transfer within 24–48 hrs. App available on Android and iOS."
        ),
    },
    {
        "doc_id": "fertilizer_subsidy_01",
        "title": "Fertilizer Subsidy and DBT in India",
        "category": "scheme",
        "text": (
            "India subsidizes urea, DAP, MOP, and complex fertilizers. Urea MRP capped at Rs 266.50/50 kg bag "
            "(actual cost ~Rs 2,300 — government pays the rest). DAP: Rs 1,350/50 kg bag. "
            "DBT (Direct Benefit Transfer): subsidy transferred to fertilizer companies on proof of sale via PoS. "
            "Farmers must link Aadhaar with retailer at time of purchase. "
            "Nano urea (500 mL bottle equivalent to 1 bag of urea) available at Rs 225 from IFFCO — reduces transport costs."
        ),
    },
    {
        "doc_id": "agri_credit_01",
        "title": "Agricultural Credit and NABARD Schemes",
        "category": "scheme",
        "text": (
            "NABARD (National Bank for Agriculture and Rural Development) provides: "
            "(1) Short-term credit refinance to cooperative banks at 4.5% for crop loans. "
            "(2) RIDF (Rural Infrastructure Development Fund): funds for irrigation, roads, rural bridges — "
            "apply through state government. "
            "(3) FPO (Farmer Producer Organisation) promotion fund: Rs 10,000 crore for equity grants. "
            "(4) Dairy Entrepreneurship Development Scheme: subsidy for modern dairy units. "
            "Contact nearest District Central Cooperative Bank or NABARD Regional Office."
        ),
    },
    {
        "doc_id": "climate_smart_01",
        "title": "Climate-Smart Agriculture Practices for Indian Farmers",
        "category": "agronomy",
        "text": (
            "Climate-smart agriculture (CSA) increases productivity while reducing greenhouse gas emissions. "
            "Key practices: (1) Direct Seeded Rice (DSR): saves 30% water vs. transplanted rice, reduces methane. "
            "(2) Conservation tillage/zero tillage in wheat: saves fuel, retains soil moisture. "
            "(3) Laser land levelling: saves 20% irrigation water. "
            "(4) Crop diversification: reduce monoculture risk from erratic rainfall. "
            "(5) Agroforestry: Poplar/Eucalyptus with wheat in Punjab — additional income + carbon credits. "
            "NICRA (National Innovations on Climate Resilient Agriculture) provides village-level advisories."
        ),
    },
]


# ── Main service class ─────────────────────────────────────────────────────────

class KnowledgeService:
    def __init__(self, api_key: str | None = None):
        self.client: genai.Client | None = None
        self._key = api_key or settings.gemini_api_key or settings.GEMINI_API_KEY or None
        if self._key:
            try:
                self.client = genai.Client(api_key=self._key)
            except Exception as e:
                logger.warning(f"[KnowledgeService] Gemini client init failed: {e}")
        self.chunks: list[DocumentChunk] = []
        self._vectors_built = False
        self._init_corpus()

    def _init_corpus(self):
        for doc in _CORPUS:
            self.chunks.append(DocumentChunk(
                doc_id=doc["doc_id"],
                title=doc["title"],
                text=doc["text"],
                category=doc.get("category", "general"),
            ))

    # ── Embedding helpers ──────────────────────────────────────────────────────

    async def _embed(self, text: str) -> list[float]:
        """Embed using Gemini text-embedding-004. Falls back to TF-IDF bag-of-words on failure."""
        if self.client:
            try:
                resp = self.client.models.embed_content(
                    model="text-embedding-004",
                    contents=text,
                )
                if resp.embeddings:
                    return resp.embeddings[0].values
            except Exception as e:
                logger.warning(f"[KnowledgeService] Gemini embedding error: {e}")
        # TF-IDF fallback — word-level, more semantic than char hash
        words = text.lower().split()
        vec: dict[int, float] = {}
        for word in words:
            h = hash(word) % 512
            vec[h] = vec.get(h, 0.0) + 1.0
        norm = math.sqrt(sum(v ** 2 for v in vec.values())) or 1.0
        full = [vec.get(i, 0.0) / norm for i in range(512)]
        return full

    async def _build_vectors(self):
        if self._vectors_built:
            return
        tasks = []
        for chunk in self.chunks:
            if not chunk.embedding:
                tasks.append(self._embed(chunk.text))
        if tasks:
            embeddings = await asyncio.gather(*tasks)
            idx = 0
            for chunk in self.chunks:
                if not chunk.embedding:
                    chunk.embedding = embeddings[idx]
                    idx += 1
        self._vectors_built = True

    def _cosine(self, a: list[float], b: list[float]) -> float:
        if len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        return round(dot, 4)

    # ── Layer 1: Gemini grounded web search ───────────────────────────────────

    async def _grounded_search(self, query: str) -> dict:
        """
        Uses Gemini 2.0 Flash with Google Search grounding to answer any query
        with live web results. Returns:
          { answer, web_sources: [{title, url, snippet}] }
        """
        if not self.client:
            return {"answer": "", "web_sources": []}

        system_prompt = (
            "You are an expert agricultural advisor for Indian farmers and RSK experts. "
            "Answer the user's question comprehensively using web search results. "
            "Focus on: crop diseases, government schemes, subsidies, farming techniques, "
            "market prices, weather advisories, and agri policies relevant to India. "
            "Cite your sources clearly. Keep the answer practical and actionable. "
            "Format: 2–4 paragraphs of clear prose. Do not use markdown headers."
        )

        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=query,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    tools=[genai_types.Tool(google_search=genai_types.GoogleSearch())],
                    temperature=0.2,
                ),
            )

            answer_text = ""
            web_sources: list[dict] = []

            if response.candidates:
                candidate = response.candidates[0]
                # Extract text answer
                for part in candidate.content.parts:
                    if hasattr(part, "text") and part.text:
                        answer_text += part.text

                # Extract grounding metadata (web citations)
                if (
                    hasattr(candidate, "grounding_metadata")
                    and candidate.grounding_metadata
                ):
                    gm = candidate.grounding_metadata
                    chunks = getattr(gm, "grounding_chunks", []) or []
                    for chunk in chunks:
                        web = getattr(chunk, "web", None)
                        if web:
                            web_sources.append({
                                "title": getattr(web, "title", "Web Source"),
                                "url": getattr(web, "uri", ""),
                                "snippet": "",
                            })

            return {"answer": answer_text.strip(), "web_sources": web_sources}

        except Exception as e:
            logger.error(f"[KnowledgeService] Grounded search failed: {e}")
            return {"answer": "", "web_sources": []}

    # ── Layer 2: Local corpus retrieval ───────────────────────────────────────

    async def _local_search(self, query: str, top_k: int = 5) -> list[dict]:
        """Retrieves top-k local corpus documents by cosine similarity."""
        await self._build_vectors()
        q_vec = await self._embed(query)
        scored = []
        for chunk in self.chunks:
            if not chunk.embedding:
                continue
            score = self._cosine(q_vec, chunk.embedding)
            scored.append({
                "doc_id": chunk.doc_id,
                "title": chunk.title,
                "text": chunk.text,
                "category": chunk.category,
                "similarity": score,
            })
        scored.sort(key=lambda x: x["similarity"], reverse=True)
        # Filter low-confidence results — only return ≥ 10% similarity
        filtered = [r for r in scored if r["similarity"] >= 0.10]
        return filtered[:top_k]

    # ── Combined public API ────────────────────────────────────────────────────

    async def query_knowledge(self, query: str, top_k: int = 5) -> list[dict]:
        """
        Legacy compatibility: returns local passage list (used by old /query endpoint).
        """
        return await self._local_search(query, top_k)

    async def search(self, query: str, top_k: int = 5) -> dict:
        """
        Full dual-layer search. Runs web grounding and local corpus retrieval concurrently.
        Returns:
          {
            answer: str,                  # Gemini-synthesized answer from web
            web_sources: list[dict],      # Web citations
            local_passages: list[dict],   # Local corpus matches
          }
        """
        web_task = self._grounded_search(query)
        local_task = self._local_search(query, top_k)

        web_result, local_result = await asyncio.gather(web_task, local_task)

        return {
            "answer": web_result.get("answer", ""),
            "web_sources": web_result.get("web_sources", []),
            "local_passages": local_result,
        }
