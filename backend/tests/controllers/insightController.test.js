const insightController = require('../../src/controllers/insightController');
const grokService = require('../../src/services/grokService');

jest.mock('../../src/services/grokService');

describe('insightController - generateInsights', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {
        config: { kpis: [], charts: [] },
        data: [{ sales: 100 }]
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 400 if config is missing', async () => {
    req.body = {};
    await insightController.generateInsights(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' })
      })
    );
  });

  it('should return 200 with structured insights from grokService', async () => {
    grokService.generateInsights.mockResolvedValueOnce({
      success: true,
      source: 'grok',
      modelUsed: 'grok-2-latest',
      insights: [
        { id: 'ins-1', headline: 'Sales Growth', text: 'Sales increased 18% compared to last month.' }
      ],
      insightsHtml: '<ul><li>Sales increased 18%</li></ul>'
    });

    await insightController.generateInsights(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      source: 'grok',
      modelUsed: 'grok-2-latest',
      insights: [
        { id: 'ins-1', headline: 'Sales Growth', text: 'Sales increased 18% compared to last month.' }
      ],
      insightsHtml: '<ul><li>Sales increased 18%</li></ul>'
    });
  });
});
