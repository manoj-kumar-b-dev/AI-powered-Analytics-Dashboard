const { executeWithRetry } = require('../../src/services/ai/retryHandler');
const { buildPrompt } = require('../../src/services/ai/promptBuilder');
const { z } = require('zod');

describe('AI Integration Layer', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const testSchema = z.object({
    status: z.string(),
    code: z.number()
  });

  // 1. Success validation - Google Gemini
  it('should return successfully when Gemini returns valid JSON matching the schema', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"status": "success", "code": 200}'
            }]
          }
        }]
      })
    });

    const result = await executeWithRetry({
      provider: 'gemini',
      prompt: 'Test prompt',
      schema: testSchema
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'success', code: 200 });
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
  });

  // 2. Success validation - OpenAI
  it('should return successfully when OpenAI returns valid JSON matching the schema', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '{"status": "success", "code": 200}'
          }
        }]
      })
    });

    const result = await executeWithRetry({
      provider: 'openai',
      prompt: 'Test prompt',
      schema: testSchema
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'success', code: 200 });
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('api.openai.com');

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers.Authorization).toBe('Bearer mock-openai-api-key');
  });

  // 2.5. Success validation - Groq
  it('should return successfully when Groq returns valid JSON matching the schema', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '{"status": "success", "code": 200}'
          }
        }]
      })
    });

    const result = await executeWithRetry({
      provider: 'groq',
      prompt: 'Test prompt',
      schema: testSchema
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'success', code: 200 });
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('api.groq.com');

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers.Authorization).toBe('Bearer mock-groq-api-key');
  });

  // 2.6. Gemini auto-routing to Groq in non-test mode (simulated)
  it('should auto-route Gemini to Groq if the key is gsk_ outside test mode', async () => {
    const aiConfig = require('../../src/config/aiConfig');
    const originalGeminiKey = aiConfig.GEMINI_API_KEY;
    const originalNodeEnv = process.env.NODE_ENV;

    // Simulate non-test environment and a Groq key on Gemini config
    aiConfig.GEMINI_API_KEY = 'gsk_mock_gemini_key_as_groq';
    process.env.NODE_ENV = 'production';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '{"status": "success", "code": 200}'
          }
        }]
      })
    });

    try {
      const result = await executeWithRetry({
        provider: 'gemini',
        prompt: 'Test prompt',
        schema: testSchema
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'success', code: 200 });
      expect(mockFetch.mock.calls[0][0]).toContain('api.groq.com'); // Routed to Groq!
    } finally {
      aiConfig.GEMINI_API_KEY = originalGeminiKey;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  // 3. Success validation - Anthropic
  it('should return successfully when Anthropic returns valid JSON matching the schema', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          text: '{"status": "success", "code": 200}'
        }]
      })
    });

    const result = await executeWithRetry({
      provider: 'anthropic',
      prompt: 'Test prompt',
      schema: testSchema
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'success', code: 200 });
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('api.anthropic.com');

    const options = mockFetch.mock.calls[0][1];
    expect(options.headers['x-api-key']).toBe('mock-anthropic-api-key');
  });

  // 4. Parse failure retry recovery
  it('should retry when the first response is malformed JSON and succeed on the second attempt', async () => {
    // Attempt 1: Malformed JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{malformed_json: true'
            }]
          }
        }]
      })
    });
    // Attempt 2: Valid JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"status": "recovered", "code": 200}'
            }]
          }
        }]
      })
    });

    const result = await executeWithRetry({
      provider: 'gemini',
      prompt: 'Test prompt',
      schema: testSchema
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'recovered', code: 200 });
    expect(result.attempts).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify retry instruction append is included
    const lastCallArg = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(lastCallArg.contents[0].parts[0].text).toContain('CRITICAL: Your previous response was invalid');
  });

  // 5. Schema validation failure retry recovery
  it('should retry when the first response fails schema validation and succeed on the second attempt', async () => {
    // Attempt 1: Schema mismatch (missing status)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"code": 404}'
            }]
          }
        }]
      })
    });
    // Attempt 2: Valid JSON
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"status": "found", "code": 200}'
            }]
          }
        }]
      })
    });

    const result = await executeWithRetry({
      provider: 'gemini',
      prompt: 'Test prompt',
      schema: testSchema
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: 'found', code: 200 });
    expect(result.attempts).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // 6. Exhaust all retries and return typed error
  it('should return a typed error when all retries are exhausted', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: 'invalid JSON text'
            }]
          }
        }]
      })
    });

    const result = await executeWithRetry({
      provider: 'gemini',
      prompt: 'Test prompt',
      schema: testSchema
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('AI_INTEGRATION_FAILURE');
    expect(result.details.type).toBe('PARSE_FAILURE');
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 original + 2 retries
  });

  // 7. Prompt size restriction: cap rows at 5 and truncate long fields
  it('should strictly limit promptBuilder sampleRows to 5 and truncate long fields', () => {
    const rawRows = [
      { id: 1, text: 'a'.repeat(250) },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
      { id: 4, text: 'd' },
      { id: 5, text: 'e' },
      { id: 6, text: 'f' } // Over limit
    ];
    const metadata = { rowCount: 6, columns: [] };
    const prompt = buildPrompt({
      task: 'Test task',
      metadata,
      sampleRows: rawRows
    });

    expect(prompt).toContain('"id": 5');
    expect(prompt).not.toContain('"id": 6');
    expect(prompt).toContain('[TRUNCATED]');
    expect(prompt).toContain('a'.repeat(200));
  });
});
