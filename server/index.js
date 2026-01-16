/**
 * QuietRoute Backend Server
 * Express API with PostGIS integration for spatial queries
 */

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'quietroute',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000
});

// Test database connection
pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => console.log('⚠️  Database not connected (running in demo mode):', err.message));

// ===================
// ROUTES
// ===================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===================
// REPORTS ENDPOINTS
// ===================

/**
 * GET /api/reports
 * Get reports within a bounding box
 */
app.get('/api/reports', async (req, res) => {
  try {
    const { north, south, east, west } = req.query;
    
    if (!north || !south || !east || !west) {
      return res.status(400).json({ error: 'Missing bounding box parameters' });
    }
    
    // PostGIS spatial query
    const query = `
      SELECT 
        id, 
        type, 
        note,
        severity,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        created_at,
        expires_at,
        upvotes,
        downvotes
      FROM reports
      WHERE ST_Within(
        location::geometry,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 100
    `;
    
    const result = await pool.query(query, [west, south, east, north]);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching reports:', error);
    // Return empty array if DB not available
    res.json([]);
  }
});

/**
 * POST /api/reports
 * Create a new report
 */
app.post('/api/reports', async (req, res) => {
  try {
    const { lat, lng, type, note, severity } = req.body;
    
    if (!lat || !lng || !type) {
      return res.status(400).json({ error: 'Missing required fields: lat, lng, type' });
    }
    
    // Calculate expiry based on type
    const expiryHours = getExpiryHours(type);
    
    const query = `
      INSERT INTO reports (location, type, note, severity, expires_at)
      VALUES (
        ST_SetSRID(ST_MakePoint($1, $2), 4326),
        $3,
        $4,
        $5,
        NOW() + INTERVAL '${expiryHours} hours'
      )
      RETURNING 
        id, 
        type, 
        note,
        severity,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        created_at,
        expires_at
    `;
    
    const result = await pool.query(query, [lng, lat, type, note || '', severity || 1]);
    res.status(201).json(result.rows[0]);
    
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

/**
 * POST /api/reports/:id/upvote
 * Upvote a report
 */
app.post('/api/reports/:id/upvote', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      UPDATE reports 
      SET upvotes = upvotes + 1 
      WHERE id = $1
      RETURNING id, upvotes
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Error upvoting report:', error);
    res.status(500).json({ error: 'Failed to upvote' });
  }
});

/**
 * POST /api/reports/:id/downvote
 * Downvote a report (3 downvotes = delete)
 */
app.post('/api/reports/:id/downvote', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First increment downvotes
    const updateQuery = `
      UPDATE reports 
      SET downvotes = downvotes + 1 
      WHERE id = $1
      RETURNING id, downvotes
    `;
    
    const result = await pool.query(updateQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Delete if too many downvotes
    if (result.rows[0].downvotes >= 3) {
      await pool.query('DELETE FROM reports WHERE id = $1', [id]);
      return res.json({ message: 'Report removed due to downvotes' });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Error downvoting report:', error);
    res.status(500).json({ error: 'Failed to downvote' });
  }
});

// ===================
// STREET TAGS ENDPOINTS
// ===================

/**
 * GET /api/street-tags
 * Get street attributes for routing weights
 */
app.get('/api/street-tags', async (req, res) => {
  try {
    const { north, south, east, west } = req.query;
    
    const query = `
      SELECT 
        osm_id,
        highway,
        lit,
        surface,
        sidewalk,
        noise_level,
        ST_AsGeoJSON(geom) as geometry
      FROM street_tags
      WHERE ST_Intersects(
        geom,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
      LIMIT 500
    `;
    
    const result = await pool.query(query, [west, south, east, north]);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching street tags:', error);
    res.json([]);
  }
});

// ===================
// SAFE PLACES ENDPOINTS
// ===================

/**
 * GET /api/safe-places
 * Find nearest safe/lit public places (for panic button)
 */
app.get('/api/safe-places', async (req, res) => {
  try {
    const { lat, lng, radius = 1000 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }
    
    // Find places like police stations, 24/7 stores, hospitals
    const query = `
      SELECT 
        id,
        name,
        type,
        ST_Y(location::geometry) as lat,
        ST_X(location::geometry) as lng,
        ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as distance_meters,
        is_24_hours,
        lit
      FROM safe_places
      WHERE ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      ORDER BY distance_meters
      LIMIT 10
    `;
    
    const result = await pool.query(query, [lng, lat, radius]);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching safe places:', error);
    res.json([]);
  }
});

// ===================
// HELPER FUNCTIONS
// ===================

function getExpiryHours(type) {
  const expiryMap = {
    loud: 4,
    crowded: 2,
    obstruction: 672, // 4 weeks
    dark: 720, // 30 days
    safe: 168, // 1 week
    quiet: 168
  };
  return expiryMap[type] || 24;
}

// ===================
// START SERVER
// ===================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚶 QuietRoute API Server                                ║
║   Running on http://localhost:${PORT}                        ║
║                                                           ║
║   Endpoints:                                              ║
║   GET  /api/health         - Health check                 ║
║   GET  /api/reports        - Get reports in area          ║
║   POST /api/reports        - Create new report            ║
║   GET  /api/street-tags    - Get street attributes        ║
║   GET  /api/safe-places    - Find nearest safe places     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
