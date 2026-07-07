/**
 * Shared regex patterns for data classification.
 */

// Matches standard email format (e.g. alice@company.com)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Matches phone numbers including digits, spaces, dashes, parens, and optional country code
const PHONE_PATTERN = /^\+?[\d\s\-()]{7,20}$/;

// Matches URLs starting with http://, https://, or resembling standard domain patterns
const URL_PATTERN = /^(https?:\/\/.*|([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-z]{2,}(:\d+)?(\/.*)?)$/i;

// Matches column names ending with _id or Id (e.g. customer_id, orderId)
const ID_SUFFIX_PATTERN = /(_id|Id)$/;

// Matches column names exactly equal to id, uuid, guid (case-insensitive)
const ID_EXACT_PATTERN = /^(id|uuid|guid)$/i;

module.exports = {
  EMAIL_PATTERN,
  PHONE_PATTERN,
  URL_PATTERN,
  ID_SUFFIX_PATTERN,
  ID_EXACT_PATTERN
};
