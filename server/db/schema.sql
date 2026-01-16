-- QuietRoute PostgreSQL + PostGIS Schema
-- Run this after creating your database and enabling PostGIS

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- ===================
-- REPORTS TABLE
-- User-submitted location reports (loud, dark, crowded, etc.)
-- ===================
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    type VARCHAR(50) NOT NULL,
    note TEXT,
    severity INTEGER DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    user_id VARCHAR(100), -- Optional: for authenticated users
    
    -- Index for spatial queries
    CONSTRAINT valid_type CHECK (type IN ('loud', 'dark', 'crowded', 'obstruction', 'safe', 'quiet'))
);

-- Spatial index for fast bounding box queries
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST (location);

-- Index for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_reports_expires ON reports (expires_at) WHERE expires_at IS NOT NULL;

-- ===================
-- STREET_TAGS TABLE
-- Cached OSM street attributes for routing
-- ===================
CREATE TABLE IF NOT EXISTS street_tags (
    id SERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE NOT NULL,
    geom GEOMETRY(LineString, 4326) NOT NULL,
    highway VARCHAR(50),
    name VARCHAR(255),
    lit VARCHAR(20), -- 'yes', 'no', 'limited'
    surface VARCHAR(50), -- 'paved', 'unpaved', 'gravel', etc.
    sidewalk VARCHAR(50), -- 'both', 'left', 'right', 'no'
    noise_level INTEGER, -- Computed/estimated 1-10
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_street_tags_geom ON street_tags USING GIST (geom);

-- Index for highway type filtering
CREATE INDEX IF NOT EXISTS idx_street_tags_highway ON street_tags (highway);

-- ===================
-- SAFE_PLACES TABLE
-- Emergency/safe locations (police, hospitals, 24/7 stores)
-- ===================
CREATE TABLE IF NOT EXISTS safe_places (
    id SERIAL PRIMARY KEY,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'police', 'hospital', 'store_24h', 'metro_station'
    address TEXT,
    phone VARCHAR(50),
    is_24_hours BOOLEAN DEFAULT FALSE,
    lit BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT valid_place_type CHECK (type IN ('police', 'hospital', 'store_24h', 'metro_station', 'bus_stop', 'public_space'))
);

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_safe_places_location ON safe_places USING GIST (location);

-- ===================
-- SAMPLE DATA FOR KOLKATA
-- ===================

-- Sample safe places
INSERT INTO safe_places (location, name, type, is_24_hours, lit) VALUES
    (ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326), 'Lalbazar Police HQ', 'police', true, true),
    (ST_SetSRID(ST_MakePoint(88.3436, 22.5649), 4326), 'SSKM Hospital', 'hospital', true, true),
    (ST_SetSRID(ST_MakePoint(88.3426, 22.5839), 4326), 'Howrah Station', 'metro_station', true, true),
    (ST_SetSRID(ST_MakePoint(88.3517, 22.5678), 4326), 'Esplanade Metro', 'metro_station', true, true),
    (ST_SetSRID(ST_MakePoint(88.3529, 22.5531), 4326), 'Park Street Metro', 'metro_station', true, true),
    (ST_SetSRID(ST_MakePoint(88.3713, 22.4992), 4326), 'Jadavpur Police Station', 'police', true, true)
ON CONFLICT DO NOTHING;

-- ===================
-- CLEANUP FUNCTION
-- Automatically remove expired reports
-- ===================
CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS void AS $$
BEGIN
    DELETE FROM reports WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- You can schedule this with pg_cron or call it periodically

-- ===================
-- USEFUL VIEWS
-- ===================

-- Active reports (not expired)
CREATE OR REPLACE VIEW active_reports AS
SELECT * FROM reports
WHERE expires_at IS NULL OR expires_at > NOW();

-- High-priority reports (many upvotes, recent)
CREATE OR REPLACE VIEW hot_reports AS
SELECT * FROM active_reports
WHERE upvotes > 2
ORDER BY created_at DESC
LIMIT 50;

-- ===================
-- GRANT PERMISSIONS
-- Adjust 'quietroute_user' to your actual application user
-- ===================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO quietroute_user;
-- GRANT SELECT ON street_tags TO quietroute_user;
-- GRANT SELECT ON safe_places TO quietroute_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO quietroute_user;
