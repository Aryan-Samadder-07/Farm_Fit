/* ══════════════════════════════════════════════
   Kisan Alert — Premium Map & Dashboard Javascript
   ══════════════════════════════════════════════ */

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    const panel = document.getElementById(`panel-${target}`);
    if (panel) {
      panel.classList.add('active');
    }

    // Leaflet map refresh when returning to GIS tab
    if (target === 'gis' && map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  });
});

// Initialize Leaflet Map
let map;
function initMap() {
  const mapElement = document.getElementById('disease-map');
  if (!mapElement) return;

  // Initialize focused around Kolkata (22.5726° N, 88.3639° E)
  map = L.map('disease-map').setView([22.5726, 88.3639], 12);

  // Dark Mode Leaflet Tile Layer (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Outbreak Mock Data
  const outbreaks = [
    {
      lat: 22.565,
      lng: 88.375,
      disease: "Root Rot",
      village: "Meow Ghop Ghop",
      district: "South 24 Paraganas",
      affected: 69,
      confidence: 100,
      severity: "high"
    },
    {
      lat: 22.580,
      lng: 88.350,
      disease: "Late Blight",
      village: "Maheshtala Outpost",
      district: "South 24 Paraganas",
      affected: 34,
      confidence: 85,
      severity: "medium"
    }
  ];

  // Render Markers and Radius Circles
  outbreaks.forEach(ob => {
    const color = ob.severity === 'high' ? '#ef4444' : '#fbbf24';
    
    // Circle marker for outbreak epicenter
    const marker = L.circleMarker([ob.lat, ob.lng], {
      radius: 8,
      fillColor: color,
      color: '#fff',
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);

    // 5 km Outbreak Radius
    L.circle([ob.lat, ob.lng], {
      color: color,
      fillColor: color,
      fillOpacity: 0.08,
      radius: 2500, // 2.5 km for visualization scale
      weight: 1.5,
      dashArray: '4, 4'
    }).addTo(map);

    // Popup Binding
    const popupContent = `
      <div class="outbreak-popup-content">
        <div class="outbreak-popup-title">⚠️ OUTBREAK ALERT</div>
        <strong>Disease:</strong> ${ob.disease}<br/>
        <strong>Village:</strong> ${ob.village}<br/>
        <strong>District:</strong> ${ob.district}<br/>
        <strong>Affected Farmers:</strong> ${ob.affected}<br/>
        <strong>Avg. AI Confidence:</strong> ${ob.confidence}%
      </div>
    `;
    marker.bindPopup(popupContent);
  });
}

// Call on load
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});

// Refresh button trigger
const refreshBtn = document.getElementById('btn-refresh-map');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    console.log('Refreshing GIS Map data...');
    if (map) {
      map.invalidateSize();
    }
  });
}
