// API Configuration
// In production (Netlify), set VITE_API_URL environment variable to your ngrok URL
// Example: https://your-subdomain.ngrok-free.app

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Headers to bypass ngrok browser warning
export const getApiHeaders = (additionalHeaders = {}) => ({
  'ngrok-skip-browser-warning': 'true',
  ...additionalHeaders,
});
