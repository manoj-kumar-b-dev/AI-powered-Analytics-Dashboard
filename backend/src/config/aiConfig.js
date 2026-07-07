const dotenv = require('dotenv');
// Ensure env vars are loaded
dotenv.config();

const AI_PROVIDER = process.env.NODE_ENV === 'test' ? 'gemini' : (process.env.AI_PROVIDER || 'gemini'); // 'gemini' | 'openai' | 'anthropic' | 'groq'

const getApiKey = (provider) => {
  if (process.env.NODE_ENV === 'test') {
    return `mock-${provider}-api-key`;
  }

  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('CRITICAL: GEMINI_API_KEY is not defined in the environment variables. Please add it to your .env file.');
    }
    return key;
  }

  if (provider === 'groq') {
    const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('CRITICAL: GROQ_API_KEY is not defined in the environment variables. Please add it to your .env file.');
    }
    return key;
  }

  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('CRITICAL: OPENAI_API_KEY is not defined in the environment variables. Please add it to your .env file.');
    }
    return key;
  }

  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('CRITICAL: ANTHROPIC_API_KEY is not defined in the environment variables. Please add it to your .env file.');
    }
    return key;
  }

  return null;
};

// Validate key only for the active provider at startup
const ACTIVE_API_KEY = getApiKey(AI_PROVIDER);

const GEMINI_API_KEY = process.env.NODE_ENV === 'test' ? 'mock-gemini-api-key' : (process.env.GEMINI_API_KEY || (AI_PROVIDER === 'gemini' ? ACTIVE_API_KEY : ''));
const GROQ_API_KEY = process.env.NODE_ENV === 'test' ? 'mock-groq-api-key' : (process.env.GROQ_API_KEY || (AI_PROVIDER === 'groq' ? ACTIVE_API_KEY : ''));
const OPENAI_API_KEY = process.env.NODE_ENV === 'test' ? 'mock-openai-api-key' : (process.env.OPENAI_API_KEY || (AI_PROVIDER === 'openai' ? ACTIVE_API_KEY : ''));
const ANTHROPIC_API_KEY = process.env.NODE_ENV === 'test' ? 'mock-anthropic-api-key' : (process.env.ANTHROPIC_API_KEY || (AI_PROVIDER === 'anthropic' ? ACTIVE_API_KEY : ''));

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';

const GEMINI_MAX_RETRIES = parseInt(process.env.GEMINI_MAX_RETRIES, 10) || 2;
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 30000;
const GROQ_RATE_LIMIT_RPM = parseInt(process.env.GROQ_RATE_LIMIT_RPM, 10) || 25;

module.exports = {
  AI_PROVIDER,
  ACTIVE_API_KEY,
  GEMINI_API_KEY,
  GROQ_API_KEY,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GEMINI_MODEL,
  GROQ_MODEL,
  OPENAI_MODEL,
  ANTHROPIC_MODEL,
  GEMINI_MAX_RETRIES,
  GEMINI_TIMEOUT_MS,
  GROQ_RATE_LIMIT_RPM
};
