-- SQL Schema for Node.js / SQLite backend storage

CREATE TABLE IF NOT EXISTS farmers (
    farmer_id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT NOT NULL, -- JSON string or descriptive string
    preferred_language TEXT NOT NULL,
    crops TEXT NOT NULL, -- Comma-separated or JSON list of crops
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingestion_requests (
    request_id TEXT PRIMARY KEY,
    farmer_id TEXT NOT NULL,
    language TEXT NOT NULL,
    location_lat REAL,
    location_lng REAL,
    query TEXT,
    voice_transcript TEXT,
    attachments TEXT, -- JSON string array of URLs or local paths
    sync_status TEXT DEFAULT 'synced', -- 'pending', 'synced'
    timestamp TEXT NOT NULL,
    FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id)
);

CREATE TABLE IF NOT EXISTS responses (
    response_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    recommendation TEXT,
    urgency TEXT,
    translated_response TEXT,
    voice_response TEXT, -- URL or path to generated TTS file
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES ingestion_requests(request_id)
);

CREATE TABLE IF NOT EXISTS broadcast_alerts (
    alert_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    urgency TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
