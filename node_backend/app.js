require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Load custom services
const translationService = require('./services/translationService');
const speechService = require('./services/speechService');

const app = express();
const PORT = process.env.PORT || 5000;

// Setup parser and file uploads
app.use(express.json());

// Configure multer for uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Intelligence / Expert service endpoint configuration
const INTEL_SERVICE_URL = process.env.INTEL_SERVICE_URL || 'http://localhost:8000/api/v1/intel';

let db;

// Initialize SQLite Database
async function initializeDatabase() {
  try {
    db = await open({
      filename: path.join(__dirname, 'kisan_alert.db'),
      driver: sqlite3.Database
    });

    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await db.exec(schemaSql);
      console.log('[SQLite] Database schema initialized successfully.');
    } else {
      console.warn('[SQLite] schema.sql not found. Table creation skipped.');
    }

    // Seed default farmer (F-9821) if table is empty
    const count = await db.get('SELECT COUNT(*) as count FROM farmers');
    if (count.count === 0) {
      await db.run(
        `INSERT INTO farmers (farmer_id, phone_number, name, location, preferred_language, crops)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'F-9821',
          '+919876543210',
          'Rajesh Kumar',
          'South 24 Paraganas',
          'English',
          JSON.stringify(['Rice', 'Tomato'])
        ]
      );
      console.log('[SQLite] Seeded default farmer Rajesh Kumar.');
    }

    // Seed some initial broadcast alerts if none exist
    const alertCount = await db.get('SELECT COUNT(*) as count FROM broadcast_alerts');
    if (alertCount.count === 0) {
      await db.run(
        `INSERT INTO broadcast_alerts (alert_id, title, message, urgency)
         VALUES (?, ?, ?, ?)`,
        [
          'A-1',
          'Dry Spell Warning',
          'Low moisture expected in the upcoming weeks. Optimize irrigation.',
          'medium'
        ]
      );
      await db.run(
        `INSERT INTO broadcast_alerts (alert_id, title, message, urgency)
         VALUES (?, ?, ?, ?)`,
        ['A-2', 'Heavy Rain Warning', 'Heavy monsoon rains predicted in South 24 Paraganas. Clear field drains.', 'high']
      );
      console.log('[SQLite] Seeded initial broadcast alerts.');
    }

  } catch (error) {
    console.error('[SQLite] Database initialization failed:', error);
  }
}

/**
 * 1. Farmer Registration/Auth simulation
 */
app.post('/api/v1/auth/otp-send', async (req, res) => {
  const { phone } = req.body;
  console.log(`Sending Mock OTP to ${phone}`);
  
  try {
    // Check if farmer exists, if not, create dynamic profile
    let farmer = await db.get('SELECT * FROM farmers WHERE phone_number = ?', [phone]);
    if (!farmer) {
      const newId = 'F-' + Math.floor(1000 + Math.random() * 9000);
      await db.run(
        `INSERT INTO farmers (farmer_id, phone_number, name, location, preferred_language, crops)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, phone, 'Farmer ' + newId.substring(2), 'Kolkata', 'English', JSON.stringify(['Wheat'])]
      );
      console.log(`[SQLite] Auto-registered new farmer: ${newId}`);
    }
    
    res.json({ success: true, message: 'OTP sent successfully (Simulated Code: 123456)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database authentication error' });
  }
});

app.post('/api/v1/auth/otp-verify', async (req, res) => {
  const { phone, otp } = req.body;
  
  if (otp !== '123456') {
    return res.status(400).json({ success: false, message: 'Invalid OTP code. Use 123456' });
  }

  try {
    const farmer = await db.get('SELECT * FROM farmers WHERE phone_number = ?', [phone]);
    res.json({
      success: true,
      token: 'mock-jwt-token-xyz',
      farmer: {
        farmerId: farmer.farmer_id,
        phone: farmer.phone_number,
        name: farmer.name,
        location: farmer.location,
        language: farmer.preferred_language,
        crops: JSON.parse(farmer.crops)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Auth verification failed' });
  }
});

/**
 * Update Farmer Profile
 */
app.post('/api/v1/profile', async (req, res) => {
  const { farmerId, name, location, preferredLanguage, crops } = req.body;
  try {
    await db.run(
      `UPDATE farmers 
       SET name = ?, location = ?, preferred_language = ?, crops = ?
       WHERE farmer_id = ?`,
      [name, location, preferredLanguage, JSON.stringify(crops), farmerId]
    );
    
    const updatedFarmer = await db.get('SELECT * FROM farmers WHERE farmer_id = ?', [farmerId]);
    res.json({
      success: true,
      farmer: {
        farmerId: updatedFarmer.farmer_id,
        phone: updatedFarmer.phone_number,
        name: updatedFarmer.name,
        location: updatedFarmer.location,
        language: updatedFarmer.preferred_language,
        crops: JSON.parse(updatedFarmer.crops)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * 2. Inbound Farmer Intake Route
 * Accepts multipart fields and file uploads (voice, attachments)
 */
app.post('/api/v1/intake', upload.fields([
  { name: 'voice', maxCount: 1 },
  { name: 'attachments' }
]), async (req, res) => {
  try {
    const requestId = req.body.requestId || uuidv4();
    const {
      farmerId = 'F-9821',
      language = 'English',
      timestamp = new Date().toISOString()
    } = req.body;

    let queryText = req.body.query || '';
    let locationVal = req.body.location || '{}';
    let voiceTranscript = req.body.voiceTranscript || '';

    // Handle voice upload if present
    if (req.files && req.files['voice']) {
      const voiceFile = req.files['voice'][0];
      const localVoicePath = voiceFile.path;
      
      // Run through speech-to-text
      const sttResult = await speechService.transcribeAudio(localVoicePath, language);
      voiceTranscript = sttResult;
      queryText = sttResult; // voice input sets query text
    }

    const attachmentsList = req.files && req.files['attachments'] 
      ? req.files['attachments'].map(f => `/uploads/${f.filename}`)
      : [];

    const parsedLocation = typeof locationVal === 'string' ? JSON.parse(locationVal) : locationVal;

    // Detect language if English is not explicitly set and verify script
    const detectedLang = translationService.detectLanguage(queryText);
    
    // Step 1: Translate native text query to common internal English language
    const englishQuery = translationService.translateToEnglish(queryText, detectedLang);

    // Formulate Standardized Outgoing Request Payload
    const outgoingPayload = {
      requestId,
      farmerId,
      language,
      location: parsedLocation,
      query: englishQuery,
      voiceTranscript: voiceTranscript,
      attachments: attachmentsList,
      timestamp
    };

    console.log('[Node Backend] Standardized Outgoing Request Payload to Intelligence Service:', JSON.stringify(outgoingPayload, null, 2));

    // Save request locally in SQLite DB
    await db.run(
      `INSERT INTO ingestion_requests (request_id, farmer_id, language, location_lat, location_lng, query, voice_transcript, attachments, sync_status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        farmerId,
        language,
        parsedLocation.latitude || null,
        parsedLocation.longitude || null,
        queryText,
        voiceTranscript,
        JSON.stringify(attachmentsList),
        'synced',
        timestamp
      ]
    );

    // Call separate Intelligence & Expert Service
    let recommendationText = "";
    let urgencyLevel = "low";
    let alerts = [];

    try {
      const response = await axios.post(INTEL_SERVICE_URL, outgoingPayload, { timeout: 4000 });
      const intelRes = response.data;
      recommendationText = intelRes.recommendation || "";
      urgencyLevel = intelRes.urgency || "low";
      alerts = intelRes.alerts || [];
    } catch (err) {
      console.warn('[Node Backend] Failed calling Intelligence Service, running rule-based mock advisor: ', err.message);
      
      // Smart Keyword heuristic matching for advice if Teammate's backend is down
      const lowerQuery = englishQuery.toLowerCase();
      if (lowerQuery.includes('tomato') || lowerQuery.includes('leaves') || lowerQuery.includes('brown')) {
        recommendationText = "Tomato Leaf Spot or Early Blight detected. Apply a copper-based fungicide or neem oil solution. Remove infected lower leaves.";
        urgencyLevel = "medium";
        alerts = ["Rainfall expected in 48 hours. Apply fungicides before wet period."];
      } else if (lowerQuery.includes('pest') || lowerQuery.includes('bug') || lowerQuery.includes('insect') || lowerQuery.includes('rice')) {
        recommendationText = "Stem Borer or Leaf Folder outbreak warning. Use Trichogramma egg cards or spray Chlorantraniliprole 18.5% SC at 60ml/acre.";
        urgencyLevel = "high";
        alerts = ["High insect outbreak warnings in adjacent South 24 Paraganas villages."];
      } else if (lowerQuery.includes('dry') || lowerQuery.includes('water') || lowerQuery.includes('drought')) {
        recommendationText = "Moisture levels are critical. Implement drip irrigation or light watering early in the morning to preserve soil moisture.";
        urgencyLevel = "medium";
        alerts = ["Dry spell expected to continue for another 5 days."];
      } else if (lowerQuery.includes('flood') || lowerQuery.includes('heavy rain') || lowerQuery.includes('rain')) {
        recommendationText = "High precipitation advisory. Immediately clear all crop drainage pathways to prevent waterlogging and root rot.";
        urgencyLevel = "high";
        alerts = ["Heavy rain warning: expected precipitation > 100mm."];
      } else {
        recommendationText = "Crop status report received. Monitor crop leaves regularly and report any sudden color alterations or insects.";
        urgencyLevel = "low";
        alerts = ["Weekly local weather is clear."];
      }
    }

    // Step 2: Translate returned English response back to farmer's preferred language
    const langCode = (language || 'English').toLowerCase().startsWith('hi') ? 'hi' : (language.toLowerCase().startsWith('be') || language.toLowerCase().startsWith('bn')) ? 'bn' : 'en';
    const translatedAdvisory = translationService.translateFromEnglish(recommendationText, langCode);

    // Step 3: Generate Voice TTS response path in preferred language
    const voiceResponseFile = await speechService.textToSpeech(translatedAdvisory, langCode);

    const finalResponse = {
      recommendation: recommendationText,
      urgency: urgencyLevel,
      translatedResponse: translatedAdvisory,
      voiceResponse: voiceResponseFile,
      alerts: alerts
    };

    // Save Response in SQLite
    const responseId = 'RES-' + uuidv4().substring(0, 8);
    await db.run(
      `INSERT INTO responses (response_id, request_id, recommendation, urgency, translated_response, voice_response)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        responseId,
        requestId,
        recommendationText,
        urgencyLevel,
        translatedAdvisory,
        voiceResponseFile
      ]
    );

    res.status(201).json(finalResponse);

  } catch (error) {
    console.error('Error handling intake:', error);
    res.status(500).json({ error: 'Internal Ingestion pipeline error' });
  }
});

/**
 * 3. Fetch Alerts & Updates
 */
app.get('/api/v1/alerts', async (req, res) => {
  try {
    const alerts = await db.all('SELECT alert_id as id, title, message, urgency, timestamp FROM broadcast_alerts ORDER BY timestamp DESC');
    res.json(alerts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * Route to post a new alert (weather pushes, etc.)
 */
app.post('/api/v1/alerts', async (req, res) => {
  const { title, message, urgency = 'low' } = req.body;
  const alertId = 'A-' + Math.floor(100 + Math.random() * 900);
  try {
    await db.run(
      `INSERT INTO broadcast_alerts (alert_id, title, message, urgency)
       VALUES (?, ?, ?, ?)`,
      [alertId, title, message, urgency]
    );
    res.status(201).json({ success: true, alertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add alert' });
  }
});

/**
 * 4. Get History of farmer queries
 */
app.get('/api/v1/history/:farmerId', async (req, res) => {
  const { farmerId } = req.params;
  try {
    const requests = await db.all(
      `SELECT r.request_id as requestId, r.farmer_id as farmerId, r.language, 
              r.location_lat as latitude, r.location_lng as longitude, 
              r.query, r.voice_transcript as voiceTranscript, 
              r.attachments, r.timestamp, r.sync_status as isSynced,
              resp.recommendation, resp.urgency, resp.translated_response as translatedResponse, 
              resp.voice_response as voiceResponse
       FROM ingestion_requests r
       LEFT JOIN responses resp ON r.request_id = resp.request_id
       WHERE r.farmer_id = ?
       ORDER BY r.timestamp DESC`,
      [farmerId]
    );

    // Map rows to correct formats
    const formattedHistory = requests.map(row => ({
      request: {
        requestId: row.requestId,
        farmerId: row.farmerId,
        language: row.language,
        location: { latitude: row.latitude, longitude: row.longitude },
        query: row.query,
        voiceTranscript: row.voiceTranscript,
        attachments: JSON.parse(row.attachments || '[]'),
        timestamp: row.timestamp,
        isSynced: 1 // since it is already saved in backend database
      },
      response: row.recommendation ? {
        recommendation: row.recommendation,
        urgency: row.urgency,
        translatedResponse: row.translatedResponse,
        voiceResponse: row.voiceResponse,
        alerts: []
      } : null
    }));

    res.json(formattedHistory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

app.listen(PORT, async () => {
  await initializeDatabase();
  console.log(`[Node Backend] Intake & Communications server running on port ${PORT}`);
});
