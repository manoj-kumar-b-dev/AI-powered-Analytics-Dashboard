const aiConfig = require('../../config/aiConfig');

// ---------------------------------------------------------------------------
// Groq rate limiter (token-bucket, in-process)
// Groq free tier: ~30 req/min. We default to 25 RPM to stay safely under it.
// Override via GROQ_RATE_LIMIT_RPM in .env
// ---------------------------------------------------------------------------
const GROQ_RPM = parseInt(process.env.GROQ_RATE_LIMIT_RPM, 10) || 25;
const GROQ_INTERVAL_MS = 60_000 / GROQ_RPM; // ms between each allowed request

const groqQueue = [];
let groqNextAvailableAt = 0; // epoch ms when the next token is available
let groqQueueTimer = null;

/**
 * Drains groqQueue one request at a time, spaced by GROQ_INTERVAL_MS.
 */
const drainGroqQueue = () => {
  if (groqQueue.length === 0) {
    groqQueueTimer = null;
    return;
  }

  const now = Date.now();
  const wait = Math.max(0, groqNextAvailableAt - now);

  groqQueueTimer = setTimeout(() => {
    const item = groqQueue.shift();
    if (!item) { groqQueueTimer = null; return; }

    groqNextAvailableAt = Date.now() + GROQ_INTERVAL_MS;
    item.resolve(); // release the waiting caller
    drainGroqQueue();
  }, wait);
};

/**
 * Returns a promise that resolves when the caller is allowed to make a Groq
 * request, respecting the RPM limit. Callers queue up rather than fail.
 */
const acquireGroqToken = () => {
  return new Promise((resolve) => {
    const now = Date.now();

    if (groqQueue.length === 0 && now >= groqNextAvailableAt) {
      // Fast path – no queue and slot immediately available
      groqNextAvailableAt = now + GROQ_INTERVAL_MS;
      resolve();
      return;
    }

    // Slow path – queue the request
    groqQueue.push({ resolve });
    if (!groqQueueTimer) drainGroqQueue();
  });
};

/**
 * Helper to execute fetch request with configured timeout capability.
 */
const executeFetchWithTimeout = async (url, options) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), aiConfig.GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

/**
 * Adapter for Google Gemini API.
 */
const callGemini = async ({ systemInstruction, prompt, responseMimeType }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.GEMINI_MODEL}:generateContent?key=${aiConfig.GEMINI_API_KEY}`;
  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType
    }
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [
        { text: systemInstruction }
      ]
    };
  }

  const response = await executeFetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const text = await response.text();
    let detail;
    try {
      detail = JSON.parse(text);
    } catch (e) {
      detail = { message: text };
    }
    const err = new Error(`Gemini API HTTP Error: ${response.status} ${response.statusText}`);
    err.status = response.status;
    err.details = detail;
    throw err;
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    const err = new Error(`Gemini generation ended abnormally: ${candidate.finishReason}`);
    err.finishReason = candidate.finishReason;
    throw err;
  }

  const rawText = candidate?.content?.parts?.[0]?.text;
  if (rawText === undefined) {
    throw new Error('Gemini API response did not contain text content.');
  }

  return rawText;
};

/**
 * Adapter for OpenAI Chat Completions API.
 */
const callOpenAI = async ({ systemInstruction, prompt, responseMimeType }) => {
  const url = 'https://api.openai.com/v1/chat/completions';
  const messages = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const requestBody = {
    model: aiConfig.OPENAI_MODEL,
    messages,
    temperature: 0.1
  };

  if (responseMimeType === 'application/json') {
    requestBody.response_format = { type: 'json_object' };
  }

  const response = await executeFetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.OPENAI_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const text = await response.text();
    let detail;
    try {
      detail = JSON.parse(text);
    } catch (e) {
      detail = { message: text };
    }
    const err = new Error(`OpenAI API HTTP Error: ${response.status} ${response.statusText}`);
    err.status = response.status;
    err.details = detail;
    throw err;
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content;
  if (rawText === undefined || rawText === null) {
    throw new Error('OpenAI API response did not contain choices content.');
  }

  return rawText;
};

/**
 * Adapter for Anthropic Messages API.
 */
const callAnthropic = async ({ systemInstruction, prompt }) => {
  const url = 'https://api.anthropic.com/v1/messages';
  const requestBody = {
    model: aiConfig.ANTHROPIC_MODEL,
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 4096
  };

  if (systemInstruction) {
    requestBody.system = systemInstruction;
  }

  const response = await executeFetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': aiConfig.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const text = await response.text();
    let detail;
    try {
      detail = JSON.parse(text);
    } catch (e) {
      detail = { message: text };
    }
    const err = new Error(`Anthropic API HTTP Error: ${response.status} ${response.statusText}`);
    err.status = response.status;
    err.details = detail;
    throw err;
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text;
  if (rawText === undefined || rawText === null) {
    throw new Error('Anthropic API response did not contain text content.');
  }

  return rawText;
};

/**
 * Adapter for Groq Chat Completions API.
 * Automatically rate-limited to GROQ_RATE_LIMIT_RPM requests per minute.
 */
const callGroq = async ({ systemInstruction, prompt, responseMimeType }) => {
  await acquireGroqToken(); // wait for a rate-limit slot before proceeding
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const messages = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const requestBody = {
    model: aiConfig.GROQ_MODEL,
    messages,
    temperature: 0.1
  };

  if (responseMimeType === 'application/json') {
    requestBody.response_format = { type: 'json_object' };
  }

  const response = await executeFetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.GROQ_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const text = await response.text();
    let detail;
    try {
      detail = JSON.parse(text);
    } catch (e) {
      detail = { message: text };
    }
    const err = new Error(`Groq API HTTP Error: ${response.status} ${response.statusText}`);
    err.status = response.status;
    err.details = detail;
    throw err;
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content;
  if (rawText === undefined || rawText === null) {
    throw new Error('Groq API response did not contain choices content.');
  }

  // ── Groq Debug Logger ───────────────────────────────────────────────────────
  // Visible in the backend terminal AND forwarded to the browser console via
  // a special header that the frontend picks up (see visualizationService.js).
  const modelUsed = data.model || aiConfig.GROQ_MODEL;
  const usage = data.usage || {};
  console.log(
    '\n┌─────────────────────── GROQ RESPONSE ───────────────────────────┐'
  );
  console.log(`│ Model   : ${modelUsed}`);
  console.log(`│ Tokens  : prompt=${usage.prompt_tokens ?? '?'}  completion=${usage.completion_tokens ?? '?'}  total=${usage.total_tokens ?? '?'}`);
  console.log(`│ Queue   : ${groqQueue.length} request(s) still waiting`);
  console.log('│ Raw response ↓');
  console.log(rawText.length > 800 ? rawText.slice(0, 800) + '\n│ … (truncated)' : rawText);
  console.log('└──────────────────────────────────────────────────────────────────┘\n');
  // ────────────────────────────────────────────────────────────────────────────

  // Attach debug metadata to the return value so callers can forward it
  const result = rawText;
  result.__groqDebug = {
    model: modelUsed,
    usage,
    queueDepth: groqQueue.length,
    rawPreview: rawText.slice(0, 500)
  };

  return result;
};

/**
 * Unified dispatch handler for calling target LLM REST endpoints.
 *
 * @param {Object} params - Generation parameters.
 * @param {string} [params.provider] - Provider override (e.g. 'gemini', 'openai', 'anthropic').
 * @returns {Promise<string>} Raw string output from the LLM model.
 */
const callLLMAPI = async (params) => {
  const provider = params.provider || aiConfig.AI_PROVIDER;

  // Auto-route to Groq if the provider is Gemini but a Groq key is used and not in test environment
  if (provider === 'gemini' && aiConfig.GEMINI_API_KEY && aiConfig.GEMINI_API_KEY.startsWith('gsk_') && process.env.NODE_ENV !== 'test') {
    return callGroq(params);
  }

  if (provider === 'gemini') {
    return callGemini(params);
  }
  if (provider === 'groq') {
    return callGroq(params);
  }
  if (provider === 'openai') {
    return callOpenAI(params);
  }
  if (provider === 'anthropic') {
    return callAnthropic(params);
  }

  throw new Error(`Unsupported LLM Provider: ${provider}`);
};

module.exports = {
  callLLMAPI
};
