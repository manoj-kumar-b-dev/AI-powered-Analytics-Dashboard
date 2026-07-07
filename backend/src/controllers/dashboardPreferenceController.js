const { getPreferences, savePreferences } = require('../repositories/dashboardPreferenceRepository');

/**
 * GET /dashboards/:datasetId/preferences
 * Returns the saved custom layout preferences scoped to the user and dataset.
 */
exports.getPreferences = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const userId = req.user._id;

    if (!datasetId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'datasetId URL parameter is required'
        }
      });
    }

    const prefs = await getPreferences(userId, datasetId);

    // Return default overlay defaults if no configuration has been customized yet
    if (!prefs) {
      return res.status(200).json({
        hiddenWidgetIds: [],
        pinnedWidgetIds: [],
        widgetOrder: [],
        widgetSizes: {}
      });
    }

    return res.status(200).json(prefs);
  } catch (err) {
    console.error('[dashboardPreferenceController] Fetch Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve custom dashboard preferences'
      }
    });
  }
};

/**
 * PUT /dashboards/:datasetId/preferences
 * Updates/saves custom layout preferences scoped to the user and dataset.
 */
exports.updatePreferences = async (req, res) => {
  try {
    const { datasetId } = req.params;
    const userId = req.user._id;

    if (!datasetId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'datasetId URL parameter is required'
        }
      });
    }

    const { hiddenWidgetIds = [], pinnedWidgetIds = [], widgetOrder = [], widgetSizes = {} } = req.body;

    const prefs = await savePreferences(userId, datasetId, {
      hiddenWidgetIds,
      pinnedWidgetIds,
      widgetOrder,
      widgetSizes
    });

    return res.status(200).json(prefs);
  } catch (err) {
    console.error('[dashboardPreferenceController] Save Error:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save custom dashboard preferences'
      }
    });
  }
};
