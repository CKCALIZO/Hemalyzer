/**
 * IndexedDB Session Storage Utility
 * 
 * Provides a simple API for storing and retrieving session data using IndexedDB.
 * This allows storing large amounts of data (base64 images) without hitting
 * localStorage's ~5-10MB quota limit.
 */

const DB_NAME = 'HemalyzerDB';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const SESSION_KEY = 'current_session';

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

/**
 * Save session data to IndexedDB
 * @param {Object} sessionData - The session data to save
 * @returns {Promise<void>}
 */
export async function saveSession(sessionData) {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.put(sessionData, SESSION_KEY);

            request.onsuccess = () => {
                console.log('Session saved to IndexedDB');
                resolve();
            };

            request.onerror = () => {
                console.error('Error saving session:', request.error);
                reject(request.error);
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    } catch (error) {
        console.error('Failed to save session to IndexedDB:', error);
        // Fallback: try to save a lightweight version to localStorage
        try {
            const lightweightSession = {
                timestamp: sessionData.timestamp,
                thresholdMet: sessionData.thresholdMet,
                imageCount: sessionData.processedImages?.length || 0
            };
            localStorage.setItem('hemalyzer_session_fallback', JSON.stringify(lightweightSession));
        } catch (e) {
            console.error('Fallback to localStorage also failed:', e);
        }
        throw error;
    }
}

/**
 * Load session data from IndexedDB
 * @returns {Promise<Object|null>} - The session data or null if not found
 */
export async function loadSession() {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.get(SESSION_KEY);

            request.onsuccess = () => {
                const data = request.result;
                if (data) {
                    console.log('Session loaded from IndexedDB:', data);
                } else {
                    console.log('No session found in IndexedDB');
                }
                resolve(data || null);
            };

            request.onerror = () => {
                console.error('Error loading session:', request.error);
                reject(request.error);
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    } catch (error) {
        console.error('Failed to load session from IndexedDB:', error);
        return null;
    }
}

/**
 * Clear session data from IndexedDB
 * @returns {Promise<void>}
 */
export async function clearSession() {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.delete(SESSION_KEY);

            request.onsuccess = () => {
                console.log('Session cleared from IndexedDB');
                resolve();
            };

            request.onerror = () => {
                console.error('Error clearing session:', request.error);
                reject(request.error);
            };

            transaction.oncomplete = () => {
                db.close();
            };
        });
    } catch (error) {
        console.error('Failed to clear session from IndexedDB:', error);
        // Try to clear localStorage fallback as well
        try {
            localStorage.removeItem('hemalyzer_session_fallback');
            localStorage.removeItem('hemalyzer_current_session'); // Clean up old localStorage key
        } catch (e) {
            console.error('Failed to clear localStorage fallback:', e);
        }
        throw error;
    }
}

/**
 * Migrate old localStorage session to IndexedDB (one-time migration)
 * @returns {Promise<void>}
 */
export async function migrateFromLocalStorage() {
    try {
        const oldSession = localStorage.getItem('hemalyzer_current_session');
        if (oldSession) {
            const sessionData = JSON.parse(oldSession);
            await saveSession(sessionData);
            localStorage.removeItem('hemalyzer_current_session');
            console.log('Successfully migrated session from localStorage to IndexedDB');
        }
    } catch (error) {
        console.error('Failed to migrate from localStorage:', error);
    }
}
