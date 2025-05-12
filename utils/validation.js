// utils/validation.js

/**
 * Checks if a value is valid in a labeled enum list (e.g. [{ key, label }])
 * @param {string|undefined} value - value to check
 * @param {Array<{key: string, label: string}>} enumArray
 * @returns {boolean}
 */
function isEnumValid(value, enumArray) {
    return value === undefined || enumArray.some(option => option.key === value);
  }
  
  module.exports = {
    isEnumValid
  };
  