import { useState, useCallback, useRef, useEffect } from "react";
import Map, {
  Source,
  Layer,
  Marker,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl";
import maplibregl from "maplibre-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";

import { MAPBOX_TOKEN, DEFAULT_CENTER, MAP_STYLE, OSM_STYLE } from "./config";
import {
  getRoutes,
  formatDistance,
  formatDuration,
} from "./services/routingService";
import {
  searchLocation,
  getCurrentLocation,
  POPULAR_LOCATIONS,
} from "./services/geocodingService";
import {
  submitReport,
  getReportTypes,
  getReportsInArea,
} from "./services/reportService";

// Icons as inline SVGs for simplicity
const Icons = {
  Logo: () => (
    <svg viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#6366f1" }} />
          <stop offset="100%" style={{ stopColor: "#8b5cf6" }} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#routeGrad)" opacity="0.1" />
      <path
        d="M30 70 Q35 50 50 45 Q65 40 70 30"
        stroke="url(#routeGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="30" cy="70" r="6" fill="#6366f1" />
      <circle cx="70" cy="30" r="6" fill="#8b5cf6" />
    </svg>
  ),
  Origin: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
    </svg>
  ),
  Destination: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  Swap: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 16V4M7 4L3 8M7 4L11 8" />
      <path d="M17 8V20M17 20L21 16M17 20L13 16" />
    </svg>
  ),
  Volume: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 010 7.08" />
    </svg>
  ),
  Sun: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  Shield: () => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

function App() {
  // Map state
  const [viewState, setViewState] = useState({
    ...DEFAULT_CENTER,
    pitch: 0,
    bearing: 0,
  });

  // Location state
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [originSearch, setOriginSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const [originResults, setOriginResults] = useState([]);
  const [destResults, setDestResults] = useState([]);

  // Route state
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Preferences
  const [quietness, setQuietness] = useState(0.5);
  const [brightness, setBrightness] = useState(0.5);

  // Reports
  const [reports, setReports] = useState([]);
  const [isReporting, setIsReporting] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState(null);

  // Map ref
  const mapRef = useRef(null);

  // Search debounce
  const searchTimeout = useRef(null);

  // Handle origin search
  const handleOriginSearch = useCallback(async (value) => {
    setOriginSearch(value);
    clearTimeout(searchTimeout.current);

    if (value.length < 2) {
      setOriginResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      const results = await searchLocation(value);
      setOriginResults(results);
    }, 300);
  }, []);

  // Handle destination search
  const handleDestSearch = useCallback(async (value) => {
    setDestSearch(value);
    clearTimeout(searchTimeout.current);

    if (value.length < 2) {
      setDestResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      const results = await searchLocation(value);
      setDestResults(results);
    }, 300);
  }, []);

  // Select origin from search results
  const selectOrigin = (location) => {
    setOrigin(location);
    setOriginSearch(location.name);
    setOriginResults([]);
  };

  // Select destination from search results
  const selectDestination = (location) => {
    setDestination(location);
    setDestSearch(location.name);
    setDestResults([]);
  };

  // Swap origin and destination
  const swapLocations = () => {
    const tempOrigin = origin;
    const tempSearch = originSearch;
    setOrigin(destination);
    setOriginSearch(destSearch);
    setDestination(tempOrigin);
    setDestSearch(tempSearch);
  };

  // Use current location as origin
  const useCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setOrigin({ ...location, name: "Current Location" });
      setOriginSearch("Current Location");
    } catch (error) {
      alert("Could not get current location");
    }
  };

  // Calculate routes
  const calculateRoutes = useCallback(async () => {
    if (!origin || !destination) return;

    setIsLoading(true);
    try {
      const preferences = { quietness, brightness };
      const newRoutes = await getRoutes(origin, destination, preferences);
      setRoutes(newRoutes);

      if (newRoutes.length > 0) {
        setSelectedRoute(newRoutes[0].id);

        // Fit map to route bounds
        if (mapRef.current) {
          const coords = newRoutes[0].geometry.coordinates;
          const bounds = coords.reduce(
            (b, coord) => {
              return {
                minLng: Math.min(b.minLng, coord[0]),
                maxLng: Math.max(b.maxLng, coord[0]),
                minLat: Math.min(b.minLat, coord[1]),
                maxLat: Math.max(b.maxLat, coord[1]),
              };
            },
            {
              minLng: Infinity,
              maxLng: -Infinity,
              minLat: Infinity,
              maxLat: -Infinity,
            }
          );

          mapRef.current.fitBounds(
            [
              [bounds.minLng, bounds.minLat],
              [bounds.maxLng, bounds.maxLat],
            ],
            { padding: 80, duration: 1000 }
          );
        }
      }
    } catch (error) {
      console.error("Failed to calculate routes:", error);
      alert("Could not calculate routes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, quietness, brightness]);

  // Recalculate when preferences change
  useEffect(() => {
    if (origin && destination && routes.length > 0) {
      const debounce = setTimeout(calculateRoutes, 500);
      return () => clearTimeout(debounce);
    }
  }, [quietness, brightness]);

  // Load reports on map move
  const loadReports = useCallback(async () => {
    if (!mapRef.current) return;

    const bounds = mapRef.current.getBounds();
    const reportsData = await getReportsInArea({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
    setReports(reportsData);
  }, []);

  // Handle map click for reporting
  const handleMapClick = async (event) => {
    if (isReporting && selectedReportType) {
      const { lng, lat } = event.lngLat;

      await submitReport({
        lat,
        lng,
        type: selectedReportType,
      });

      setIsReporting(false);
      setSelectedReportType(null);
      loadReports();
    }
  };

  // Panic button - find nearest safe location
  const handlePanic = async () => {
    try {
      const location = await getCurrentLocation();
      // In a real app, this would query for nearest police station, 24/7 store, etc.
      alert(
        "Finding nearest safe location...\n\nThis would route you to the nearest well-lit, open public area."
      );
    } catch {
      alert("Please enable location services for emergency routing");
    }
  };

  // Get vibe label
  const getVibeLabel = (value) => {
    if (value < 0.3) return "Low";
    if (value < 0.7) return "Medium";
    return "High";
  };

  // Route layer style
  const routeLayerStyle = {
    id: "route-layer",
    type: "line",
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["case", ["get", "selected"], 6, 4],
      "line-opacity": ["case", ["get", "selected"], 1, 0.5],
    },
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
  };

  // Create GeoJSON for routes
  const routesGeoJSON = {
    type: "FeatureCollection",
    features: routes.map((route) => ({
      type: "Feature",
      properties: {
        id: route.id,
        color: route.color,
        selected: route.id === selectedRoute,
      },
      geometry: route.geometry,
    })),
  };

  // Create GeoJSON for noise heatmap
  const heatmapGeoJSON = {
    type: "FeatureCollection",
    features: reports
      .filter((r) => r.type === "loud" || r.type === "crowded" || r.type === "traffic")
      .map((r) => ({
        type: "Feature",
        properties: {
          intensity: r.type === "loud" ? 1.0 : 0.6,
        },
        geometry: {
          type: "Point",
          coordinates: [r.lng, r.lat],
        },
      })),
  };

  // Heatmap layer style
  const heatmapLayerStyle = {
    id: "heatmap-layer",
    type: "heatmap",
    paint: {
      "heatmap-weight": ["get", "intensity"],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(33,102,172,0)",
        0.2,
        "rgb(103,169,207)",
        0.4,
        "rgb(209,229,240)",
        0.6,
        "rgb(253,219,199)",
        0.8,
        "rgb(239,138,98)",
        1,
        "rgb(178,24,43)",
      ],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
      "heatmap-opacity": 0.6,
    },
  };

  // Check if we should use OSM tiles (no valid Mapbox token)
  const useOSM = !MAPBOX_TOKEN || MAPBOX_TOKEN.includes("placeholder");

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <header className="sidebar-header">
          <div className="sidebar-logo">
            <Icons.Logo />
            <h1>
              QuietRoute
              <span>Navigate Peacefully in Kolkata</span>
            </h1>
          </div>
        </header>

        <div className="sidebar-content">
          {/* Search Panel */}
          <section className="search-panel">
            <h2>Plan Your Route</h2>

            <div className="location-inputs">
              <div className="location-input-wrapper origin">
                <span className="icon">
                  <Icons.Origin />
                </span>
                <input
                  type="text"
                  className="location-input"
                  placeholder="Starting point"
                  value={originSearch}
                  onChange={(e) => handleOriginSearch(e.target.value)}
                  onFocus={() => handleOriginSearch(originSearch)}
                />
                {originResults.length > 0 && (
                  <div
                    className="search-results"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "var(--color-bg-secondary)",
                      borderRadius: "var(--radius-md)",
                      marginTop: "4px",
                      zIndex: 100,
                      boxShadow: "var(--shadow-lg)",
                    }}
                  >
                    {originResults.map((result) => (
                      <div
                        key={result.id}
                        onClick={() => selectOrigin(result)}
                        style={{
                          padding: "12px 16px",
                          cursor: "pointer",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          fontSize: "14px",
                        }}
                        onMouseEnter={(e) =>
                          (e.target.style.background =
                            "var(--color-bg-tertiary)")
                        }
                        onMouseLeave={(e) =>
                          (e.target.style.background = "transparent")
                        }
                      >
                        <div style={{ fontWeight: 500 }}>{result.name}</div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--color-text-muted)",
                            marginTop: "2px",
                          }}
                        >
                          {result.displayName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="swap-btn"
                onClick={swapLocations}
                title="Swap locations"
              >
                <Icons.Swap />
              </button>

              <div className="location-input-wrapper destination">
                <span className="icon">
                  <Icons.Destination />
                </span>
                <input
                  type="text"
                  className="location-input"
                  placeholder="Destination"
                  value={destSearch}
                  onChange={(e) => handleDestSearch(e.target.value)}
                  onFocus={() => handleDestSearch(destSearch)}
                />
                {destResults.length > 0 && (
                  <div
                    className="search-results"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "var(--color-bg-secondary)",
                      borderRadius: "var(--radius-md)",
                      marginTop: "4px",
                      zIndex: 100,
                      boxShadow: "var(--shadow-lg)",
                    }}
                  >
                    {destResults.map((result) => (
                      <div
                        key={result.id}
                        onClick={() => selectDestination(result)}
                        style={{
                          padding: "12px 16px",
                          cursor: "pointer",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          fontSize: "14px",
                        }}
                        onMouseEnter={(e) =>
                          (e.target.style.background =
                            "var(--color-bg-tertiary)")
                        }
                        onMouseLeave={(e) =>
                          (e.target.style.background = "transparent")
                        }
                      >
                        <div style={{ fontWeight: 500 }}>{result.name}</div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--color-text-muted)",
                            marginTop: "2px",
                          }}
                        >
                          {result.displayName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
              <button
                onClick={useCurrentLocation}
                style={{
                  flex: 1,
                  padding: "8px",
                  background: "var(--color-bg-tertiary)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text-secondary)",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                📍 Use My Location
              </button>
            </div>
          </section>

          {/* Vibe Toggle Section */}
          <section className="vibe-section">
            <h2>Route Preferences</h2>

            <div className="vibe-toggles">
              <div className="vibe-toggle">
                <div className="vibe-toggle-header">
                  <label className="vibe-toggle-label">
                    <span className="icon">
                      <Icons.Volume />
                    </span>
                    Quietness Priority
                  </label>
                  <span className="vibe-toggle-value">
                    {getVibeLabel(quietness)}
                  </span>
                </div>
                <input
                  type="range"
                  className="vibe-slider quiet"
                  min="0"
                  max="1"
                  step="0.1"
                  value={quietness}
                  onChange={(e) => setQuietness(parseFloat(e.target.value))}
                />
                <div className="vibe-labels">
                  <span>Fastest</span>
                  <span>Quietest</span>
                </div>
              </div>

              <div className="vibe-toggle">
                <div className="vibe-toggle-header">
                  <label className="vibe-toggle-label">
                    <span className="icon">
                      <Icons.Sun />
                    </span>
                    Lighting Priority
                  </label>
                  <span className="vibe-toggle-value">
                    {getVibeLabel(brightness)}
                  </span>
                </div>
                <input
                  type="range"
                  className="vibe-slider brightness"
                  min="0"
                  max="1"
                  step="0.1"
                  value={brightness}
                  onChange={(e) => setBrightness(parseFloat(e.target.value))}
                />
                <div className="vibe-labels">
                  <span>Any</span>
                  <span>Well-Lit</span>
                </div>
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={calculateRoutes}
              disabled={!origin || !destination || isLoading}
            >
              {isLoading ? "Calculating..." : "Find Routes"}
            </button>
          </section>

          {/* Route Results */}
          {routes.length > 0 && (
            <section className="route-results animate-slide-up">
              <h2>Route Options</h2>

              {routes.map((route, index) => (
                <div
                  key={route.id}
                  className={`route-card ${
                    route.id === selectedRoute ? "selected" : ""
                  } ${route.recommended ? "recommended" : ""}`}
                  onClick={() => setSelectedRoute(route.id)}
                >
                  <div className="route-card-header">
                    <span className="route-card-title">
                      {index === 0 ? "Best Match" : `Alternative ${index}`}
                    </span>
                    {route.recommended && (
                      <span className="route-card-badge">Recommended</span>
                    )}
                  </div>

                  <div className="route-card-stats">
                    <div className="route-stat">
                      <span className="route-stat-value">
                        {formatDuration(route.duration)}
                      </span>
                      <span className="route-stat-label">Duration</span>
                    </div>
                    <div className="route-stat">
                      <span className="route-stat-value">
                        {formatDistance(route.distance)}
                      </span>
                      <span className="route-stat-label">Distance</span>
                    </div>
                  </div>

                  <div className="route-card-indicators">
                    <div className="indicator">
                      <span className="indicator-dot quiet"></span>
                      Quiet streets
                    </div>
                    <div className="indicator">
                      <span className="indicator-dot lit"></span>
                      Well lit
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Report Section */}
          <section className="report-section">
            <h2>Report an Issue</h2>
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
                marginBottom: "12px",
              }}
            >
              {isReporting
                ? "Click on the map to place your report"
                : "Help others navigate safely"}
            </p>

            <div className="report-tags">
              {getReportTypes().map((type) => (
                <button
                  key={type.id}
                  className={`report-tag ${
                    isReporting && selectedReportType === type.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setIsReporting(true);
                    setSelectedReportType(type.id);
                  }}
                >
                  <span className="emoji">{type.emoji}</span>
                  {type.label}
                </button>
              ))}
            </div>

            {isReporting && (
              <button
                style={{
                  width: "100%",
                  marginTop: "12px",
                  padding: "8px",
                  background: "transparent",
                  border: "1px solid var(--color-accent-rose)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-accent-rose)",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setIsReporting(false);
                  setSelectedReportType(null);
                }}
              >
                Cancel Reporting
              </button>
            )}
          </section>
        </div>
      </aside>

      {/* Map Container */}
      <div className="map-container">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          onMoveEnd={loadReports}
          onClick={handleMapClick}
          style={{ width: "100%", height: "100%" }}
          mapStyle={useOSM ? OSM_STYLE : MAP_STYLE}
          mapLib={useOSM ? maplibregl : undefined}
          mapboxAccessToken={useOSM ? undefined : MAPBOX_TOKEN}
          cursor={isReporting ? "crosshair" : "grab"}
        >
          <NavigationControl position="top-right" />
          <GeolocateControl position="top-right" trackUserLocation />
          
          {/* Noise Heatmap */}
          <Source id="noise-heatmap" type="geojson" data={heatmapGeoJSON}>
            <Layer {...heatmapLayerStyle} />
          </Source>

          {/* Route lines */}
          {routes.length > 0 && (
            <Source id="routes" type="geojson" data={routesGeoJSON}>
              <Layer {...routeLayerStyle} />
            </Source>
          )}

          {/* Origin marker */}
          {origin && (
            <Marker
              longitude={origin.lng}
              latitude={origin.lat}
              anchor="center"
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--color-accent-emerald)",
                  border: "3px solid white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              />
            </Marker>
          )}

          {/* Destination marker */}
          {destination && (
            <Marker
              longitude={destination.lng}
              latitude={destination.lat}
              anchor="bottom"
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="var(--color-accent-rose)"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
            </Marker>
          )}

          {/* Report markers */}
          {reports.map((report) => (
            <Marker
              key={report.id}
              longitude={report.lng}
              latitude={report.lat}
              anchor="center"
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--color-bg-glass)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  boxShadow: "var(--shadow-md)",
                }}
                title={`${report.type} report`}
              >
                {getReportTypes().find((t) => t.id === report.type)?.emoji ||
                  "⚠️"}
              </div>
            </Marker>
          ))}
        </Map>

        {/* Heatmap Legend */}
        <div className="heatmap-legend">
          <div className="legend-item">
            <span style={{ color: "var(--color-quiet)" }}>●</span> Quiet
          </div>
          <div className="legend-gradient"></div>
          <div className="legend-item">
            <span style={{ color: "var(--color-loud)" }}>●</span> Loud
          </div>
        </div>
      </div>

      {/* Panic Button */}
      <button
        className="panic-btn"
        onClick={handlePanic}
        title="Emergency: Find Safe Location"
      >
        <Icons.Shield />
      </button>

      {/* Loading Overlay */}
      {isLoading && (
        <div
          className="loading-overlay"
          style={{ background: "rgba(10,10,15,0.8)" }}
        >
          <div className="loading-spinner"></div>
          <p className="loading-text">Finding the best routes for you...</p>
        </div>
      )}
    </div>
  );
}

export default App;
