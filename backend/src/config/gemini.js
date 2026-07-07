/**
 * Gemini AI Client
 *
 * Central singleton for Google Gemini API access.
 * Uses gemini-2.0-flash-exp for fast, cost-efficient structured JSON generation.
 *
 * All three recommendation services (KPI, Chart, Insight) use this client.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;

let genAI = null;
let model = null;
let useGroq = false;
let groqModelName = 'llama-3.3-70b-versatile';

if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  if (apiKey.startsWith('gsk_')) {
    useGroq = true;
    groqModelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    model = {
      modelName: groqModelName
    };
    console.log('[Groq] Client initialized (via gemini config) — AI-powered KPI/Chart/Insight generation active.');
  } else {
    try {
      genAI = new GoogleGenerativeAI(apiKey);
      model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,       // Low temp = deterministic, consistent suggestions
          topP: 0.8,
          maxOutputTokens: 4096
        }
      });
      console.log('[Gemini] Client initialized — AI-powered KPI/Chart/Insight generation active.');
    } catch (err) {
      console.error('[Gemini] Failed to initialize client:', err.message);
    }
  }
} else {
  console.warn('[Gemini] GEMINI_API_KEY not set. AI suggestions will be disabled. Set GEMINI_API_KEY in .env to enable LLM-powered recommendations.');
}

const QUEUE_DELAY_MS = 4000; // 4 seconds delay = ~15 requests per minute
const requestQueue = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const { prompt, resolve, reject } = requestQueue.shift();

    try {
      let responseText;

      if (useGroq) {
        // Call Groq API via fetch
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: groqModelName,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 4096
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Groq API Error: ${response.status} ${response.statusText} - ${errText}`);
        }

        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content?.trim();
      } else {
        const result = await model.generateContent(prompt);
        responseText = result.response.text().trim();
      }

      console.log('\n--- [Raw Response] ---');
      console.log(responseText);
      console.log('---------------------\n');

      // Strip markdown code fences if Gemini/Groq wraps JSON in them
      const cleaned = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      resolve(JSON.parse(cleaned));
    } catch (err) {
      reject(err);
    }

    // Delay before the next request to respect rate limits
    if (requestQueue.length > 0) {
      await new Promise((res) => setTimeout(res, QUEUE_DELAY_MS));
    }
  }

  isProcessingQueue = false;
}

/**
 * Send a prompt to Gemini and parse the JSON response.
 * Requests are queued and delayed to avoid hitting free tier rate limits (15 RPM).
 * @param {string} prompt - Full prompt text
 * @returns {Promise<any>} - Parsed JSON object/array from Gemini
 * @throws {Error} if Gemini is not configured or parsing fails
 */
async function geminiGenerate(prompt) {
  if (!model) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in .env');
  }

  return new Promise((resolve, reject) => {
    requestQueue.push({ prompt, resolve, reject });
    processQueue();
  });
}

module.exports = { geminiGenerate, isGeminiAvailable: () => !!model };
