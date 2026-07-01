const fs = require('fs');
const path = require('path');

const MOCK_TRANSCRIPTS = {
  "hi": "मेरी धान की फसल में कीड़े लग गए हैं और पत्तियां पीली पड़ रही हैं।",
  "bn": "আমার ধানের ফসলে পোকামাকড় আক্রমণ করেছে এবং পাতা হলুদ হয়ে যাচ্ছে।",
  "en": "My tomato leaves are getting brown patches and drying up."
};

class SpeechService {
  async transcribeAudio(audioFilePath, languageCode) {
    console.log(`[SpeechService] Transcribing audio file at ${audioFilePath} for language: ${languageCode}`);
    const lang = (languageCode || 'en').split('-')[0];
    return MOCK_TRANSCRIPTS[lang] || MOCK_TRANSCRIPTS['en'];
  }

  async textToSpeech(text, languageCode) {
    console.log(`[SpeechService] Generating TTS for text: "${text}" in language: ${languageCode}`);
    // Simulate TTS by writing a mock audio file to uploads directory if not present
    const ttsFilename = `tts-${Date.now()}.mp3`;
    const ttsPath = path.join(__dirname, '..', 'uploads', ttsFilename);
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Write 0 bytes or basic text content as dummy mp3 file
    fs.writeFileSync(ttsPath, Buffer.from([]));
    
    return `/uploads/${ttsFilename}`;
  }
}

module.exports = new SpeechService();
