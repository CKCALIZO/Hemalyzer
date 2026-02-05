// API Configuration
// In production (Netlify), set VITE_API_URL environment variable to your ngrok URL
// Example: https://your-subdomain.ngrok-free.app

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
