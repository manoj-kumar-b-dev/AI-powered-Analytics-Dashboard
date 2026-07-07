const dashboardPreferenceController = require('../../src/controllers/dashboardPreferenceController');
const { getPreferences, savePreferences } = require('../../src/repositories/dashboardPreferenceRepository');

// Mock repository methods
jest.mock('../../src/repositories/dashboardPreferenceRepository', () => ({
  getPreferences: jest.fn(),
  savePreferences: jest.fn()
}));

describe('Dashboard Preferences Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('GET /dashboards/:datasetId/preferences', () => {
    it('should return default empty preference object when no preferences exist', async () => {
      mockReq = {
        params: { datasetId: 'dataset-123' },
        user: { _id: 'user-789' }
      };

      getPreferences.mockResolvedValue(null);

      await dashboardPreferenceController.getPreferences(mockReq, mockRes);

      expect(getPreferences).toHaveBeenCalledWith('user-789', 'dataset-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        hiddenWidgetIds: [],
        pinnedWidgetIds: [],
        widgetOrder: [],
        widgetSizes: {}
      });
    });

    it('should return saved preferences when they exist', async () => {
      const mockPrefs = {
        userId: 'user-789',
        datasetId: 'dataset-123',
        hiddenWidgetIds: ['w1'],
        pinnedWidgetIds: ['w2'],
        widgetOrder: ['w2', 'w1'],
        widgetSizes: { w1: { w: 6, h: 4 } }
      };

      mockReq = {
        params: { datasetId: 'dataset-123' },
        user: { _id: 'user-789' }
      };

      getPreferences.mockResolvedValue(mockPrefs);

      await dashboardPreferenceController.getPreferences(mockReq, mockRes);

      expect(getPreferences).toHaveBeenCalledWith('user-789', 'dataset-123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockPrefs);
    });

    it('should return 400 bad request if datasetId parameter is missing', async () => {
      mockReq = {
        params: {},
        user: { _id: 'user-789' }
      };

      await dashboardPreferenceController.getPreferences(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_PARAMETERS'
        })
      }));
    });
  });

  describe('PUT /dashboards/:datasetId/preferences', () => {
    it('should successfully save preferences and return updated object', async () => {
      const prefsPayload = {
        hiddenWidgetIds: ['w1'],
        pinnedWidgetIds: ['w2'],
        widgetOrder: ['w2', 'w1'],
        widgetSizes: { w1: { w: 6, h: 4 } }
      };

      mockReq = {
        params: { datasetId: 'dataset-123' },
        user: { _id: 'user-789' },
        body: prefsPayload
      };

      savePreferences.mockResolvedValue({
        userId: 'user-789',
        datasetId: 'dataset-123',
        ...prefsPayload
      });

      await dashboardPreferenceController.updatePreferences(mockReq, mockRes);

      expect(savePreferences).toHaveBeenCalledWith('user-789', 'dataset-123', prefsPayload);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(prefsPayload));
    });

    it('should return 400 bad request if datasetId parameter is missing on save', async () => {
      mockReq = {
        params: {},
        user: { _id: 'user-789' },
        body: {}
      };

      await dashboardPreferenceController.updatePreferences(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_PARAMETERS'
        })
      }));
    });
  });
});
