import os
from dotenv import load_dotenv
load_dotenv()

from services.translation_service import TranslationService

def test():
    print("Initializing TranslationService...")
    ts = TranslationService()
    print(f"Translation client: {ts.client}")
    print(f"MOCK_GCP_APIS setting: {os.getenv('MOCK_GCP_APIS')}")
    
    try:
        print("Testing language detection...")
        lang = ts.detect_language("कीड़े")
        print(f"Detected: {lang}")
        
        print("Testing translation to English...")
        translated = ts.translate_to_english("कीड़े", source_language="hi")
        print(f"Translated to EN: {translated}")
        
        print("Testing batch translation of diagnosis result...")
        disease = "Tomato Late Blight"
        steps = [
            "Prune infected lower leaves.",
            "Apply copper-based fungicide spray."
        ]
        trans_disease, trans_steps = ts.translate_diagnosis_result(disease, steps, "hi")
        print(f"Translated Disease: {repr(trans_disease)}")
        print(f"Translated Steps: {repr(trans_steps)}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test()
