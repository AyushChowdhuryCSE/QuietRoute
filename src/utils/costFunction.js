/**
 * QuietRoute Cost Function
 * The core innovation: weighted routing based on noise, lighting, and user reports
 */

import { NOISE_WEIGHTS, LIGHTING_WEIGHTS, REPORT_TYPES } from '../config';

/**
 * Calculate the weighted cost for a route segment
 * @param {Object} edge - Road segment with properties
 * @param {Object} preferences - User preferences (quietness: 0-1, brightness: 0-1)
 * @param {Array} reports - Active user reports in the area
 * @returns {number} Weighted cost
 */
export function calculateEdgeCost(edge, preferences = {}, reports = []) {
  const baseCost = edge.distance || 100; // meters
  
  // Get multipliers
  const noiseMultiplier = getNoiseMultiplier(edge, preferences.quietness || 0.5);
  const darknessMultiplier = getDarknessMultiplier(edge, preferences.brightness || 0.5);
  const reportsMultiplier = getReportsMultiplier(edge, reports);
  const timeMultiplier = getTimeBasedMultiplier(edge);
  
  return baseCost * noiseMultiplier * darknessMultiplier * reportsMultiplier * timeMultiplier;
}

/**
 * Get noise multiplier based on road type and user preference
 * @param {Object} edge - Road segment
 * @param {number} quietness - User's quietness preference (0 = don't care, 1 = very quiet)
 * @returns {number} Multiplier (1.0 = neutral, > 1 = avoid, < 1 = prefer)
 */
export function getNoiseMultiplier(edge, quietness) {
  if (quietness === 0) return 1.0; // User doesn't care about noise
  
  const highway = edge.highway || 'residential';
  const baseNoise = NOISE_WEIGHTS[highway] || 1.0;
  
  // Scale by user preference
  // At quietness = 0, multiplier = 1.0 for all roads
  // At quietness = 1, multiplier is fully applied
  const scaledNoise = 1.0 + (baseNoise - 1.0) * quietness;
  
  return Math.max(0.5, Math.min(3.0, scaledNoise));
}

/**
 * Get darkness multiplier based on lighting data and user preference
 * @param {Object} edge - Road segment  
 * @param {number} brightness - User's brightness preference (0 = don't care, 1 = very lit)
 * @returns {number} Multiplier
 */
export function getDarknessMultiplier(edge, brightness) {
  if (brightness === 0) return 1.0; // User doesn't care about lighting
  
  // Check if it's nighttime
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour > 18;
  
  if (!isNight) {
    return 1.0; // Lighting doesn't matter during day
  }
  
  const lit = edge.lit || 'unknown';
  const baseWeight = LIGHTING_WEIGHTS[`lit_${lit}`] || LIGHTING_WEIGHTS.lit_unknown;
  
  // Scale by user preference
  const scaledWeight = 1.0 + (baseWeight - 1.0) * brightness;
  
  return Math.max(0.5, Math.min(2.5, scaledWeight));
}

/**
 * Get multiplier based on active user reports near the edge
 * @param {Object} edge - Road segment
 * @param {Array} reports - Active reports [{lat, lon, type, severity}]
 * @returns {number} Multiplier
 */
export function getReportsMultiplier(edge, reports) {
  if (!reports || reports.length === 0) return 1.0;
  
  let totalWeight = 1.0;
  
  // Check reports within ~50m of edge
  reports.forEach(report => {
    const distance = getDistanceToEdge(report, edge);
    if (distance < 50) { // meters
      const reportType = REPORT_TYPES[report.type];
      if (reportType) {
        // Closer reports have more impact
        const impact = reportType.weight * (1 - distance / 50);
        totalWeight += impact;
      }
    }
  });
  
  return Math.min(5.0, totalWeight); // Cap at 5x
}

/**
 * Get time-based multiplier for dynamic routing
 * @param {Object} edge - Road segment
 * @returns {number} Multiplier
 */
export function getTimeBasedMultiplier(edge) {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  
  let multiplier = 1.0;
  
  // School zones are loud 7-9 AM and 2-4 PM on weekdays
  if (edge.school_zone) {
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isSchoolHours = (hour >= 7 && hour <= 9) || (hour >= 14 && hour <= 16);
    if (isWeekday && isSchoolHours) {
      multiplier *= 1.8;
    }
  }
  
  // Club/bar areas are loud 9 PM - 2 AM on weekends
  if (edge.nightlife_zone) {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const isNightlife = hour >= 21 || hour <= 2;
    if (isWeekend && isNightlife) {
      multiplier *= 2.0;
    }
  }
  
  // Markets are crowded during day
  if (edge.market_zone) {
    const isMarketHours = hour >= 8 && hour <= 20;
    if (isMarketHours) {
      multiplier *= 1.5;
    }
  }
  
  return multiplier;
}

/**
 * Calculate rough distance from a point to an edge
 * @param {Object} point - {lat, lon}
 * @param {Object} edge - Road segment with coordinates
 * @returns {number} Distance in meters
 */
function getDistanceToEdge(point, edge) {
  if (!edge.coordinates || edge.coordinates.length === 0) {
    return Infinity;
  }
  
  // Simple approximation: check distance to start/end of edge
  const start = edge.coordinates[0];
  const end = edge.coordinates[edge.coordinates.length - 1];
  
  const distToStart = haversineDistance(
    point.lat, point.lon,
    start[1], start[0]
  );
  
  const distToEnd = haversineDistance(
    point.lat, point.lon,
    end[1], end[0]
  );
  
  return Math.min(distToStart, distToEnd);
}

/**
 * Haversine formula to calculate distance between two points
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

/**
 * Score a complete route based on preferences
 * @param {Object} route - Route with geometry and statistics
 * @param {Object} preferences - User preferences
 * @returns {Object} Route with score and breakdown
 */
export function scoreRoute(route, preferences) {
  const stats = {
    totalDistance: route.distance || 0,
    estimatedTime: route.duration || 0,
    noiseScore: calculateRouteNoiseScore(route),
    lightingScore: calculateRouteLightingScore(route),
    safetyScore: calculateRouteSafetyScore(route)
  };
  
  // Overall score (0-100, higher is better for user preferences)
  const quietnessScore = 100 - (stats.noiseScore * preferences.quietness * 100);
  const brightnessScore = stats.lightingScore * preferences.brightness * 100;
  
  stats.overallScore = (quietnessScore + brightnessScore) / 2;
  
  return {
    ...route,
    stats
  };
}

function calculateRouteNoiseScore(route) {
  // Heuristic: Combine Speed and Turn Density
  // 1. Average Speed: Higher speed = likely major road/highway = Louder
  // 2. Turn Density: Few turns = straight road = likely major road = Louder
  
  if (!route.distance || !route.duration) return 0.5;
  
  // 1. Speed Score
  const avgSpeed = route.distance / route.duration; // m/s
  // Cap speed influence at ~15 m/s (54 km/h)
  const speedScore = Math.min(1.0, avgSpeed / 15);
  
  // 2. Turn Score
  const steps = listSteps(route);
  const turnsPerKm = steps.length > 0 ? (steps.length / (route.distance / 1000)) : 0;
  
  // High turns = Low noise. 
  // 0 turns/km -> 1.0 noise
  // 10 turns/km -> 0.5 noise
  // 20 turns/km -> 0.33 noise
  const turnScore = 1 / (1 + 0.1 * turnsPerKm);
  
  // Weighted combination (Speed is usually a stronger signal for road type)
  const noise = (speedScore * 0.7) + (turnScore * 0.3);
  
  // Clamp
  const finalScore = Math.max(0.1, Math.min(0.9, noise));
  
  // Debug log (temporary, visible in console)
  console.log(`[CostFn] Route ${route.id || '?'}: Speed=${avgSpeed.toFixed(1)}m/s (${speedScore.toFixed(2)}), Turns/km=${turnsPerKm.toFixed(1)} (${turnScore.toFixed(2)}) -> Noise=${finalScore.toFixed(2)}`);
  
  return finalScore;
}

function calculateRouteLightingScore(route) {
  // Heuristic: Straight paths (major roads) are usually better lit than winding back alleys.
  // Inverse of noise score roughly.
  
  const noiseScore = calculateRouteNoiseScore(route);
  
  // High noise (major road) => High lighting (good)
  // Low noise (alley) => Low lighting (bad)
  
  return Math.max(0.2, Math.min(0.9, noiseScore * 1.2)); // Correlated
}

function calculateRouteSafetyScore(route) {
  // Prefer well-lit areas for safety
  const lighting = calculateRouteLightingScore(route);
  return lighting; 
}

function listSteps(route) {
  let steps = [];
  if (route.legs) {
    route.legs.forEach(leg => {
      if (leg.steps) steps = steps.concat(leg.steps);
    });
  }
  return steps;
}
