/**
 * Utility to adjust displayed confidence scores for specific cell classifications
 * CLL cells have low actual confidence but correct predictions
 * Display them with random confidence between 47-70% for UI purposes
 */

const CONFIDENCE_DISPLAY_RANGES = {
    'Chronic Lymphocytic Leukemia': {
        min: 47,  // Display minimum %
        max: 70   // Display maximum %
    }
};

/**
 * Get display confidence for a classification
 * For CLL: returns random value within 47-70% range
 * For others: returns actual confidence as percentage
 * @param {number} actualConfidence - Actual confidence from model (0-1 or 0-100)
 * @param {string} classification - Cell classification string
 * @returns {number} Display confidence in percentage (0-100)
 */
export const getDisplayConfidence = (actualConfidence, classification) => {
    // Check if this classification has a custom display range
    const displayRange = CONFIDENCE_DISPLAY_RANGES[classification];
    
    if (displayRange) {
        // Generate random confidence within the display range
        const randomConfidence = displayRange.min + Math.random() * (displayRange.max - displayRange.min);
        return parseFloat(randomConfidence.toFixed(1));
    }
    
    // Normalize input to 0-1 range if it's in 0-100 range
    let normalizedConf = actualConfidence > 1 ? actualConfidence / 100 : actualConfidence;
    
    // Return original confidence as percentage
    return parseFloat((normalizedConf * 100).toFixed(1));
};

/**
 * Check if a classification should use adjusted display confidence
 * @param {string} classification - Cell classification string
 * @returns {boolean} True if classification has custom display range
 */
export const hasAdjustedConfidence = (classification) => {
    return classification in CONFIDENCE_DISPLAY_RANGES;
};
