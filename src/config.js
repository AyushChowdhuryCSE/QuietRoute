// QuietRoute - Mapbox Configuration
// Using free tier with public token placeholder

// For production, replace with your own Mapbox access token
// Get one free at: https://account.mapbox.com/
export const MAPBOX_TOKEN = 'pk.eyJ1IjoicXVpZXRyb3V0ZS1kZW1vIiwiYSI6ImNscXh5ejAxMjBhMWYyaW1wbzN5c2N1OGwifQ.demo-token-placeholder';

// Kolkata, West Bengal - Center coordinates
export const DEFAULT_CENTER = {
  longitude: 88.3639,
  latitude: 22.5726,
  zoom: 13
};

// Map style - Dark theme optimized for route visualization
export const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

// Alternative free style using OpenStreetMap tiles (if Mapbox token unavailable)
export const OSM_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

// OSRM Routing Server (local Docker instance)
export const OSRM_SERVER = 'http://localhost:5000';

// Alternative public OSRM demo server (for testing)
export const OSRM_DEMO_SERVER = 'https://router.project-osrm.org';

// Backend API
export const API_BASE_URL = 'http://localhost:3001/api';

// Route color palette
export const ROUTE_COLORS = {
  fastest: '#f59e0b',
  quietest: '#10b981', 
  brightest: '#22d3ee',
  default: '#8b5cf6',
  alternate: '#6366f1'
};

// Noise level weights for cost calculation
export const NOISE_WEIGHTS = {
  // Highway types from OSM
  motorway: 3.0,
  trunk: 2.8,
  primary: 2.5,
  secondary: 2.0,
  tertiary: 1.5,
  residential: 1.0,
  living_street: 0.8,
  pedestrian: 0.6,
  path: 0.5,
  footway: 0.5,
  cycleway: 0.7
};

// Lighting weights for cost calculation  
export const LIGHTING_WEIGHTS = {
  lit_yes: 0.5,       // Well lit - prefer
  lit_limited: 1.0,   // Some lighting
  lit_no: 2.0,        // No lighting - avoid
  lit_unknown: 1.5    // Assume moderate
};

// Report types for user submissions
export const REPORT_TYPES = {
  loud: { label: 'Loud', emoji: '🔊', weight: 2.0, color: '#ef4444' },
  dark: { label: 'Dark', emoji: '🌑', weight: 1.8, color: '#64748b' },
  crowded: { label: 'Crowded', emoji: '👥', weight: 1.5, color: '#f59e0b' },
  obstruction: { label: 'Obstruction', emoji: '⚠️', weight: 3.0, color: '#dc2626' },
  safe: { label: 'Safe', emoji: '✅', weight: 0.7, color: '#10b981' },
  quiet: { label: 'Quiet', emoji: '🤫', weight: 0.5, color: '#22d3ee' }
};
