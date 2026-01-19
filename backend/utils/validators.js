/**
 * Validation utilities for meat cut data
 */

/**
 * Validate price range
 * @param {number} min - Minimum price
 * @param {number} max - Maximum price
 * @returns {boolean} - True if valid
 */
export function validatePriceRange(min, max) {
  if (typeof min !== 'number' || typeof max !== 'number') {
    return false;
  }
  if (min < 0 || max < 0) {
    return false;
  }
  if (min > max) {
    return false;
  }
  return true;
}

/**
 * Parse price display string (e.g., "$6 – $9") to min, max, mean
 * @param {string} priceDisplay - Price display string
 * @returns {{min: number, max: number, mean: number} | null} - Parsed prices or null if invalid
 */
export function parsePriceDisplay(priceDisplay) {
  if (!priceDisplay || typeof priceDisplay !== 'string') {
    return null;
  }
  
  // Remove $ and spaces, split by common separators (–, -, to)
  const cleaned = priceDisplay.replace(/\$/g, '').trim();
  const separators = /[–\-\s+to\s+]/i;
  const parts = cleaned.split(separators).map(p => p.trim()).filter(p => p);
  
  if (parts.length < 1) {
    return null;
  }
  
  const min = parseFloat(parts[0]);
  const max = parts.length > 1 ? parseFloat(parts[1]) : min;
  
  if (isNaN(min) || isNaN(max)) {
    return null;
  }
  
  const mean = (min + max) / 2;
  
  return { min, max, mean };
}

/**
 * Validate meat cut data
 * @param {object} data - Meat cut data
 * @returns {{valid: boolean, errors: string[]}} - Validation result
 */
export function validateMeatCut(data) {
  const errors = [];
  
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  if (!data.chineseName && !data.chinese_name) {
    errors.push('Chinese name is required');
  }
  
  if (!data.part || typeof data.part !== 'string' || data.part.trim().length === 0) {
    errors.push('Part is required');
  }
  
  if (typeof data.lean !== 'boolean') {
    errors.push('Lean must be a boolean');
  }
  
  if (data.priceMin === undefined || data.priceMax === undefined) {
    errors.push('Price min and max are required');
  } else if (!validatePriceRange(data.priceMin, data.priceMax)) {
    errors.push('Invalid price range');
  }
  
  if (!data.imageReference && !data.image_reference) {
    errors.push('Image reference is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalize lean value (convert string "Yes"/"No" to boolean)
 * @param {string|boolean} value - Lean value
 * @returns {boolean} - Normalized boolean
 */
export function normalizeLean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'yes' || lower === 'true' || lower === '1';
  }
  return false;
}
