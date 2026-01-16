/**
 * QuietRoute Routing Service
 * Handles route calculation with OSRM and custom weights
 */

import { OSRM_DEMO_SERVER, OSRM_SERVER, ROUTE_COLORS } from '../config';
import { scoreRoute } from '../utils/costFunction';

// Try local OSRM first, fall back to demo server
let osrmServer = OSRM_DEMO_SERVER;

/**
 * Get multiple route alternatives between two points
 * @param {Object} origin - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @param {Object} preferences - {quietness: 0-1, brightness: 0-1}
 * @returns {Promise<Array>} Array of route options
 */
export async function getRoutes(origin, destination, preferences = {}) {
  try {
    // Request route with alternatives
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${osrmServer}/route/v1/foot/${coords}?overview=full&alternatives=3&steps=true&geometries=geojson`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OSRM error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes) {
      throw new Error('No routes found');
    }
    
    // Process and score each route
    const routes = data.routes.map((route, index) => {
      const processed = {
        id: `route-${index}`,
        geometry: route.geometry,
        distance: route.distance, // meters
        duration: route.duration, // seconds
        legs: route.legs,
        color: getRouteColor(index, preferences)
      };
      
      // Add scoring based on preferences
      return scoreRoute(processed, preferences);
    });
    
    // Debug: Log scores to understand sorting behavior
    console.log('--- Route Scoring Debug ---');
    console.log('Preferences:', preferences);
    routes.forEach(r => {
      console.log(`Route ${r.id}: Noise=${r.stats.noiseScore.toFixed(2)}, Light=${r.stats.lightingScore.toFixed(2)}, Total=${r.stats.overallScore.toFixed(2)}`);
    });

    // Sort by best match to preferences
    routes.sort((a, b) => (b.stats?.overallScore || 0) - (a.stats?.overallScore || 0));
    
    console.log('Top route after sort:', routes[0].id);
    console.log('---------------------------');

    // Mark best route as recommended
    if (routes.length > 0) {
      routes[0].recommended = true;
    }
    
    return routes;
    
  } catch (error) {
    console.error('Routing error:', error);
    
    // Try local server if demo fails
    if (osrmServer === OSRM_DEMO_SERVER) {
      console.log('Trying local OSRM server...');
      osrmServer = OSRM_SERVER;
      return getRoutes(origin, destination, preferences);
    }
    
    throw error;
  }
}

/**
 * Get driving/walking directions with turn-by-turn instructions
 * @param {Object} origin 
 * @param {Object} destination 
 * @returns {Promise<Object>} Route with instructions
 */
export async function getDirections(origin, destination) {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${osrmServer}/route/v1/foot/${coords}?overview=full&steps=true&geometries=geojson`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok') {
    throw new Error('Failed to get directions');
  }
  
  const route = data.routes[0];
  const instructions = [];
  
  route.legs.forEach(leg => {
    leg.steps.forEach(step => {
      instructions.push({
        text: formatInstruction(step),
        distance: step.distance,
        duration: step.duration,
        location: step.maneuver.location
      });
    });
  });
  
  return {
    route: route.geometry,
    distance: route.distance,
    duration: route.duration,
    instructions
  };
}

/**
 * Format OSRM step into readable instruction
 * @param {Object} step 
 * @returns {string}
 */
function formatInstruction(step) {
  const maneuver = step.maneuver;
  const name = step.name || 'the path';
  
  switch (maneuver.type) {
    case 'depart':
      return `Start on ${name}`;
    case 'arrive':
      return `Arrive at destination`;
    case 'turn':
      return `Turn ${maneuver.modifier} onto ${name}`;
    case 'continue':
      return `Continue on ${name}`;
    case 'fork':
      return `Take the ${maneuver.modifier} fork onto ${name}`;
    default:
      return `${maneuver.type} on ${name}`;
  }
}

/**
 * Get appropriate color for route based on index and preferences
 * @param {number} index 
 * @param {Object} preferences 
 * @returns {string} Color hex code
 */
function getRouteColor(index, preferences) {
  if (preferences.quietness > 0.7) {
    return index === 0 ? ROUTE_COLORS.quietest : ROUTE_COLORS.alternate;
  }
  if (preferences.brightness > 0.7) {
    return index === 0 ? ROUTE_COLORS.brightest : ROUTE_COLORS.alternate;
  }
  return index === 0 ? ROUTE_COLORS.default : ROUTE_COLORS.alternate;
}

/**
 * Format distance for display
 * @param {number} meters 
 * @returns {string}
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 * @param {number} seconds 
 * @returns {string}
 */
export function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}
