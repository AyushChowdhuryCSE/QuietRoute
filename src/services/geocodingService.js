/**
 * QuietRoute Geocoding Service
 * Convert addresses to coordinates and vice versa
 */

// Using Nominatim (OpenStreetMap) for free geocoding
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/**
 * Search for locations by text query
 * @param {string} query - Search text
 * @param {Object} options - {limit, bounds}
 * @returns {Promise<Array>} Location results
 */
export async function searchLocation(query, options = {}) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: 1,
    limit: options.limit || 5
  });
  
  // Bias to Kolkata area
  if (!options.disableBias) {
    params.append('viewbox', '88.2,22.4,88.5,22.7'); // Kolkata bounding box
    params.append('bounded', '0'); // Prefer but don't limit to bbox
  }
  
  try {
    const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: {
        'User-Agent': 'QuietRoute/1.0 (student project)'
      }
    });
    
    if (!response.ok) {
      throw new Error('Geocoding failed');
    }
    
    const results = await response.json();
    
    return results.map(r => ({
      id: r.place_id,
      name: r.name || r.display_name.split(',')[0],
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      type: r.type,
      address: r.address
    }));
    
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to address
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<Object>} Location details
 */
export async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    lat: lat,
    lon: lng,
    format: 'json',
    addressdetails: 1
  });
  
  try {
    const response = await fetch(`${NOMINATIM_URL}/reverse?${params}`, {
      headers: {
        'User-Agent': 'QuietRoute/1.0 (student project)'
      }
    });
    
    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }
    
    const result = await response.json();
    
    return {
      id: result.place_id,
      name: result.name || formatAddress(result.address),
      displayName: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      address: result.address
    };
    
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Format address object into readable string
 * @param {Object} address 
 * @returns {string}
 */
function formatAddress(address) {
  if (!address) return 'Unknown location';
  
  const parts = [];
  
  if (address.road) parts.push(address.road);
  if (address.suburb) parts.push(address.suburb);
  if (address.city || address.town || address.village) {
    parts.push(address.city || address.town || address.village);
  }
  
  return parts.join(', ') || 'Unknown location';
}

/**
 * Get user's current location
 * @returns {Promise<Object>} {lat, lng}
 */
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * Popular locations in Kolkata for quick access
 */
export const POPULAR_LOCATIONS = [
  { name: 'Howrah Station', lat: 22.5839, lng: 88.3426 },
  { name: 'Victoria Memorial', lat: 22.5448, lng: 88.3426 },
  { name: 'Park Street', lat: 22.5531, lng: 88.3529 },
  { name: 'Salt Lake City', lat: 22.5800, lng: 88.4133 },
  { name: 'Esplanade', lat: 22.5678, lng: 88.3517 },
  { name: 'New Town', lat: 22.5958, lng: 88.4847 },
  { name: 'Jadavpur University', lat: 22.4992, lng: 88.3713 },
  { name: 'Dakshineswar Temple', lat: 22.6547, lng: 88.3575 }
];
