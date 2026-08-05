const grokService = require('../../src/services/grokService');

describe('GrokService - AI Insight Generator', () => {
  let originalEnv;
  let mockFetch;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  const sampleContext = {
    kpis: [
      { name: 'Total Sales', value: 15000 },
      { name: 'Total Expenses', value: 9000 }
    ],
    charts: [
      { title: 'Regional Revenue', type: 'bar' }
    ],
    data: [
      { date: '2026-07-01', region: 'South', sales: 500, product: 'Product A', expenses: 300 },
      { date: '2026-07-02', region: 'South', sales: 700, product: 'Product A', expenses: 400 },
      { date: '2026-07-05', region: 'North', sales: 300, product: 'Product B', expenses: 250 },
      { date: '2026-07-06', region: 'South', sales: 900, product: 'Product A', expenses: 500 }
    ]
  };

  it('should generate insights using Grok API when GROK_API_KEY is present', async () => {
    process.env.GROK_API_KEY = 'xai-mock-key';

    const mockGrokResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              insights: [
                {
                  id: 'ins-1',
                  category: 'growth',
                  headline: 'Sales Surge',
                  text: 'Sales increased 18% compared to last month.',
                  badgeText: '+18% Sales',
                  badgeType: 'success',
                  icon: 'trending-up'
                },
                {
                  id: 'ins-2',
                  category: 'top_performer',
                  headline: 'Regional Dominance',
                  text: 'South region generated the highest revenue.',
                  badgeText: 'South Region',
                  badgeType: 'info',
                  icon: 'trophy'
                }
              ],
              html: '<ul><li>Sales increased 18% compared to last month.</li></ul>'
            })
          }
        }
      ]
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGrokResponse
    });

    const result = await grokService.generateInsights(sampleContext);

    expect(result.success).toBe(true);
    expect(result.source).toBe('grok');
    expect(result.insights).toHaveLength(2);
    expect(result.insights[0].text).toContain('Sales increased 18%');
    expect(result.insights[1].text).toContain('South region');

    // Verify fetch call structure
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.x.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer xai-mock-key'
        })
      })
    );
  });

  it('should use statistical fallback generator when GROK_API_KEY is omitted', async () => {
    delete process.env.GROK_API_KEY;

    const result = await grokService.generateInsights(sampleContext);

    expect(result.success).toBe(true);
    expect(result.source).toBe('smart_analytics');
    expect(result.insights).toBeDefined();
    expect(result.insights.length).toBeGreaterThan(0);

    // Verify fallback categories exist
    const categories = result.insights.map(i => i.category);
    expect(categories).toContain('growth');
    expect(categories).toContain('top_performer');
    expect(categories).toContain('recommendation');
    expect(result.insightsHtml).toContain('<ul');
  });

  it('should fallback gracefully to statistical engine if Grok API call throws network error', async () => {
    process.env.GROK_API_KEY = 'xai-mock-key';

    mockFetch.mockRejectedValueOnce(new Error('Network error connecting to x.ai'));

    const result = await grokService.generateInsights(sampleContext);

    expect(result.success).toBe(true);
    expect(result.source).toBe('smart_analytics');
    expect(result.insights.length).toBeGreaterThan(0);
  });
});
