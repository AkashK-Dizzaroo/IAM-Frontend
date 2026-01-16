/**
 * MongoDB ObjectId Generator Utility
 * Generates valid MongoDB ObjectId-like strings for demo purposes
 */

/**
 * Generate a valid MongoDB ObjectId-like string (24 hex characters)
 * @returns {string} A 24-character hexadecimal string
 */
export const generateObjectId = () => {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate multiple ObjectIds
 * @param {number} count - Number of ObjectIds to generate
 * @returns {string[]} Array of ObjectId strings
 */
export const generateObjectIds = (count = 1) => {
  return Array.from({ length: count }, () => generateObjectId());
};

/**
 * Check if a string is a valid ObjectId format
 * @param {string} id - String to check
 * @returns {boolean} True if valid ObjectId format
 */
export const isValidObjectId = (id) => {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Generate demo ObjectIds for common entities
 */
export const demoObjectIds = {
  user: generateObjectId(),
  project: generateObjectId(),
  study: generateObjectId(),
  document: generateObjectId(),
  accessRequest: generateObjectId()
};

export default {
  generateObjectId,
  generateObjectIds,
  isValidObjectId,
  demoObjectIds
};
