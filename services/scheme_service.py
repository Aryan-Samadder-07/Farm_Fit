from typing import List, Dict, Any

class GovernmentSchemeResult:
    def __init__(self, scheme_name: str, eligibility: str, benefit: str, description: str, documents_required: List[str]):
        self.scheme_name = scheme_name
        self.eligibility = eligibility
        self.benefit = benefit
        self.description = description
        self.documents_required = documents_required

class SchemeService:
    def get_matching_schemes(
        self,
        farmer_name: str,
        crop_type: str,
        farm_size_acres: float,
        location_id: str
    ) -> List[Dict[str, Any]]:
        """
        Recommends state and national government assistance schemes based on farmer demographic and crop metrics.
        """
        schemes = []
        
        # Clean crop_type of any fallback debugging suffixes
        crop_clean = crop_type.replace(" (AI Fallback Mode)", "").strip()
        crop_lower = crop_clean.lower()

        # 1. PM-KISAN (National Scheme)
        if farm_size_acres <= 5.0:  # typically targets small/marginal farmers
            schemes.append({
                "scheme_name": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
                "benefit": "₹6,000 per year, delivered in three equal installments of ₹2,000",
                "eligibility": "Small and marginal landholder farmer families with cultivable land holdings up to 2 hectares.",
                "description": "Central sector income support scheme to enable farmers to purchase agricultural inputs and meet domestic needs.",
                "documents_required": ["Land Ownership Records", "Aadhaar Card", "Bank Account Details"]
            })

        # 2. PM Fasal Bima Yojana (Crop Insurance)
        if crop_lower in ["rice", "maize", "tomato", "cotton"]:
            schemes.append({
                "scheme_name": "PMFBY (Pradhan Mantri Fasal Bima Yojana)",
                "benefit": "Insurance coverage against crop damage from pests, diseases, droughts, and natural disasters.",
                "eligibility": "All farmers growing notified crops in notified areas, including tenant farmers.",
                "description": "Provides financial support to stabilize farmer income and encourage modern agricultural practices.",
                "documents_required": ["Land Sowing Certificate", "Pattadar Passbook / Tenancy Agreement", "Aadhaar Card"]
            })

        # 3. AP State Micro Irrigation Subsidy (Andhra Pradesh specific)
        if "ap" in location_id.lower() or "nellore" in location_id.lower() or "anantapur" in location_id.lower():
            subsidy_pct = "90%" if farm_size_acres <= 2.5 else "70%"
            schemes.append({
                "scheme_name": "APMIP Drip & Sprinkler Subsidy",
                "benefit": f"{subsidy_pct} subsidy on purchase of micro-irrigation systems (Drip/Sprinkler)",
                "eligibility": "Farmers owning cultivable land in Andhra Pradesh. Higher subsidies are allocated to small/marginal holdings.",
                "description": "State-level water management initiative targeting water conservation and crop productivity boost.",
                "documents_required": ["Land Title Deed", "Water Source Certificate", "Aadhaar Card", "Soil Test Report"]
            })

            # 4. AP Rythu Bharosa (Andhra Pradesh State Scheme)
            schemes.append({
                "scheme_name": "YSR Rythu Bharosa - PM KISAN",
                "benefit": "₹13,500 annual investment support (includes ₹6,000 PM-KISAN component)",
                "eligibility": "All landholding farmer families in Andhra Pradesh, including tenant farmers belonging to SC/ST/BC categories.",
                "description": "Andhra Pradesh state flagship initiative to assist farmers towards capital inputs during crop sowing seasons.",
                "documents_required": ["Pattadar Passbook", "Aadhaar Card", "Bank Account Passbook"]
            })

        return schemes
