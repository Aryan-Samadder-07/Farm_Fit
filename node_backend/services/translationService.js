const SUPPORTED_LANGUAGES = {
  "en": "English",
  "hi": "Hindi",
  "bn": "Bengali"
};

// Mock translations from Indic languages to English (aligned with python service)
const MOCK_TO_ENGLISH = [
  { keywords: ["कीड़े", "कीट", "टिड्डी"], english: "Pests have infested my rice crop and the leaves are turning yellow." },
  { keywords: ["পোকামাকড়", "পোকা", "রোগ"], english: "Insects have infested my rice crop and leaves are yellowing." },
  { keywords: ["सूखा", "पानी नहीं", "जल संकट"], english: "Drought conditions - my crops are drying up due to lack of water." },
  { keywords: ["flood", "बाढ़", "বন্যা"], english: "Flooding has damaged my fields." },
  { keywords: ["टमाटर", "tomato", "টমেটো", "পাতায় দাগ"], english: "My tomato leaves are getting brown patches and drying up." }
];

const MOCK_FROM_ENGLISH = {
  "hi": "कृपया अपनी फसल पर नीम के तेल के मिश्रण का छिड़काव करें ताकि पत्तियों को और नुकसान न पहुंचे।",
  "bn": "অনুগ্রহ করে আপনার ফসলে নিম তেলের মিশ্রণ স্প্রে করুন যাতে পাতার আর ক্ষতি না হয়।"
};

class TranslationService {
  detectLanguage(text) {
    if (!text) return 'en';
    // Heuristic script check: Devanagari range for Hindi, Bengali range for Bengali
    if (/[\u0900-\u097F]/.test(text)) {
      return 'hi';
    }
    if (/[\u0980-\u09FF]/.test(text)) {
      return 'bn';
    }
    return 'en';
  }

  translateToEnglish(text, sourceLang) {
    if (!text) return '';
    const lang = (sourceLang || this.detectLanguage(text)).split('-')[0];
    if (lang === 'en') return text;
    
    const lowerText = text.toLowerCase();
    for (const entry of MOCK_TO_ENGLISH) {
      if (entry.keywords.some(kw => lowerText.includes(kw))) {
        return entry.english;
      }
    }
    return `Farmer report: ${text} [Auto-translated from ${SUPPORTED_LANGUAGES[lang] || lang}]`;
  }

  translateFromEnglish(text, targetLang) {
    const lang = (targetLang || 'en').split('-')[0];
    if (lang === 'en') return text;
    
    if (MOCK_FROM_ENGLISH[lang]) {
      return MOCK_FROM_ENGLISH[lang];
    }
    return `[Advisory translated to ${SUPPORTED_LANGUAGES[lang] || lang}]: ${text}`;
  }
}

module.exports = new TranslationService();
