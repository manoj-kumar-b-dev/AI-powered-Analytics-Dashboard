/**
 * groqDebugLogger.js
 *
 * Prints Groq / LLM API responses to the **browser** developer console.
 * Only active when:
 *   - NODE_ENV !== 'production'   (Vite sets import.meta.env.MODE)
 *   - OR window.__GROQ_DEBUG__ = true is set manually in the console
 *
 * Usage:
 *   import { logGroqResponse } from '@/utils/groqDebugLogger';
 *   logGroqResponse('ChartRecommendation', rawResponseText, metaObject);
 */

const isDebugEnabled = () =>
  import.meta.env.MODE !== 'production' || window.__GROQ_DEBUG__ === true;

/**
 * Log a Groq/LLM response to the browser console with colour-coded grouping.
 *
 * @param {string} label      - Context label, e.g. 'ChartRecommendation'
 * @param {string} rawText    - The raw string returned by the Groq model
 * @param {Object} [meta]     - Optional metadata (model, tokens, queue depth, etc.)
 */
export const logGroqResponse = (label, rawText, meta = {}) => {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toLocaleTimeString();
  const preview = typeof rawText === 'string' ? rawText.slice(0, 600) : JSON.stringify(rawText).slice(0, 600);
  const isTruncated = typeof rawText === 'string' && rawText.length > 600;

  console.groupCollapsed(
    `%c🤖 Groq Response%c [${label}] %c${timestamp}`,
    'color:#a78bfa;font-weight:bold;font-size:13px;',
    'color:#e2e8f0;font-size:12px;',
    'color:#64748b;font-size:11px;'
  );

  if (meta.model) {
    console.log('%cModel     %c' + meta.model,  'color:#818cf8;font-weight:bold;', 'color:#e2e8f0;');
  }
  if (meta.usage) {
    const u = meta.usage;
    console.log(
      '%cTokens    %cprompt=%s  completion=%s  total=%s',
      'color:#818cf8;font-weight:bold;',
      'color:#e2e8f0;',
      u.prompt_tokens ?? '?',
      u.completion_tokens ?? '?',
      u.total_tokens ?? '?'
    );
  }
  if (meta.queueDepth !== undefined) {
    console.log('%cQueue     %c%s request(s) still waiting', 'color:#818cf8;font-weight:bold;', 'color:#e2e8f0;', meta.queueDepth);
  }
  if (meta.attempts !== undefined) {
    console.log('%cAttempts  %c' + meta.attempts, 'color:#818cf8;font-weight:bold;', 'color:#e2e8f0;');
  }

  console.log('%cRaw Response ↓', 'color:#818cf8;font-weight:bold;');
  console.log('%c' + preview + (isTruncated ? '\n… (truncated, full text below)' : ''), 'color:#d1fae5;font-family:monospace;');

  if (isTruncated) {
    console.log('%cFull raw text:', 'color:#64748b;');
    console.log(rawText);
  }

  // Try to pretty-print if it looks like JSON
  try {
    const parsed = JSON.parse(rawText);
    console.log('%cParsed JSON:', 'color:#818cf8;font-weight:bold;');
    console.log(parsed);
  } catch {
    // Not JSON – that's fine
  }

  console.groupEnd();
};

/**
 * Log a structured AI result object (after parsing + validation).
 *
 * @param {string} label   - Context label
 * @param {Object} result  - The { success, data, attempts } object from retryHandler
 */
export const logGroqResult = (label, result = {}) => {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toLocaleTimeString();
  const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
  const styleStatus = result.success ? 'color:#34d399;font-weight:bold;' : 'color:#f87171;font-weight:bold;';

  console.groupCollapsed(
    `%c🤖 Groq Result%c [${label}] %c${status}  ${timestamp}`,
    'color:#a78bfa;font-weight:bold;font-size:13px;',
    'color:#e2e8f0;font-size:12px;',
    styleStatus + 'font-size:12px;'
  );

  if (result.attempts) {
    console.log('%cAttempts used: %c' + result.attempts, 'color:#818cf8;font-weight:bold;', 'color:#e2e8f0;');
  }

  if (result.success && result.data) {
    console.log('%cParsed & Validated Data:', 'color:#818cf8;font-weight:bold;');
    console.log(result.data);
  }

  if (!result.success && result.details) {
    console.warn('%cError Details:', 'color:#f87171;font-weight:bold;');
    console.warn(result.details);
  }

  console.groupEnd();
};
