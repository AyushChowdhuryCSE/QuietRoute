/**
 * QuietRoute Report Service
 * Handles user-submitted location reports (loud, dark, crowded, etc.)
 */

import { REPORT_TYPES, API_BASE_URL } from '../config';

const STORAGE_KEY = 'quietroute_reports';

/**
 * Submit a new report
 * @param {Object} report - {lat, lng, type, note}
 * @returns {Promise<Object>} Created report
 */
export async function submitReport(report) {
  const newReport = {
    id: generateId(),
    lat: report.lat,
    lng: report.lng,
    type: report.type,
    note: report.note || '',
    severity: report.severity || 1,
    createdAt: new Date().toISOString(),
    expiresAt: getExpiryDate(report.type),
    upvotes: 0,
    downvotes: 0
  };
  
  // Try to save to backend, fall back to localStorage
  try {
    const response = await fetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReport)
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('Backend unavailable, using localStorage');
  }
  
  // Fallback: save to localStorage
  const reports = getLocalReports();
  reports.push(newReport);
  saveLocalReports(reports);
  
  return newReport;
}

/**
 * Get reports within a bounding box
 * @param {Object} bounds - {north, south, east, west}
 * @returns {Promise<Array>} Reports in area
 */
export async function getReportsInArea(bounds) {
  try {
    const params = new URLSearchParams({
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west
    });
    
    const response = await fetch(`${API_BASE_URL}/reports?${params}`);
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('Backend unavailable, using localStorage');
  }
  
  // Fallback: filter localStorage reports
  const reports = getLocalReports();
  return reports.filter(report => {
    return report.lat >= bounds.south &&
           report.lat <= bounds.north &&
           report.lng >= bounds.west &&
           report.lng <= bounds.east &&
           !isExpired(report);
  });
}

/**
 * Get all active reports from localStorage
 * @returns {Array} Reports
 */
function getLocalReports() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const reports = JSON.parse(stored);
    // Filter out expired reports
    return reports.filter(r => !isExpired(r));
  } catch {
    return [];
  }
}

/**
 * Save reports to localStorage
 * @param {Array} reports 
 */
function saveLocalReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

/**
 * Check if a report has expired
 * @param {Object} report 
 * @returns {boolean}
 */
function isExpired(report) {
  if (!report.expiresAt) return false;
  return new Date(report.expiresAt) < new Date();
}

/**
 * Get expiry date based on report type
 * @param {string} type 
 * @returns {string} ISO date string
 */
function getExpiryDate(type) {
  const now = new Date();
  
  switch (type) {
    case 'loud':
      // Loud alerts expire in 4 hours
      now.setHours(now.getHours() + 4);
      break;
    case 'crowded':
      // Crowd alerts expire in 2 hours
      now.setHours(now.getHours() + 2);
      break;
    case 'obstruction':
      // Obstructions last 4 weeks
      now.setDate(now.getDate() + 28);
      break;
    case 'dark':
      // Dark spots last until fixed (30 days default)
      now.setDate(now.getDate() + 30);
      break;
    default:
      // Default: 24 hours
      now.setHours(now.getHours() + 24);
  }
  
  return now.toISOString();
}

/**
 * Upvote a report (confirms it's still valid)
 * @param {string} reportId 
 */
export async function upvoteReport(reportId) {
  const reports = getLocalReports();
  const report = reports.find(r => r.id === reportId);
  
  if (report) {
    report.upvotes = (report.upvotes || 0) + 1;
    saveLocalReports(reports);
  }
}

/**
 * Downvote/dismiss a report
 * @param {string} reportId 
 */
export async function downvoteReport(reportId) {
  const reports = getLocalReports();
  const report = reports.find(r => r.id === reportId);
  
  if (report) {
    report.downvotes = (report.downvotes || 0) + 1;
    
    // Remove if too many downvotes
    if (report.downvotes >= 3) {
      const filtered = reports.filter(r => r.id !== reportId);
      saveLocalReports(filtered);
    } else {
      saveLocalReports(reports);
    }
  }
}

/**
 * Get report type metadata
 * @param {string} type 
 * @returns {Object}
 */
export function getReportTypeMeta(type) {
  return REPORT_TYPES[type] || REPORT_TYPES.loud;
}

/**
 * Get all available report types
 * @returns {Array}
 */
export function getReportTypes() {
  return Object.entries(REPORT_TYPES).map(([key, value]) => ({
    id: key,
    ...value
  }));
}

/**
 * Generate unique ID
 * @returns {string}
 */
function generateId() {
  return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
