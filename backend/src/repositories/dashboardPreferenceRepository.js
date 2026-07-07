const DashboardPreference = require('../models/dashboardPreference');

/**
 * Loads preferences scoped to a user and dataset.
 *
 * @param {string} userId - The database user ID.
 * @param {string} datasetId - The database dataset ID.
 * @returns {Promise<Object>} The DashboardPreference document.
 */
const getPreferences = async (userId, datasetId) => {
  return DashboardPreference.findOne({ userId, datasetId });
};

/**
 * Upserts user dashboard preferences scoped to a user and dataset.
 *
 * @param {string} userId - The database user ID.
 * @param {string} datasetId - The database dataset ID.
 * @param {Object} preferencesData - Custom overlay properties.
 * @returns {Promise<Object>} The updated or new DashboardPreference document.
 */
const savePreferences = async (userId, datasetId, preferencesData) => {
  const { hiddenWidgetIds, pinnedWidgetIds, widgetOrder, widgetSizes } = preferencesData;
  return DashboardPreference.findOneAndUpdate(
    { userId, datasetId },
    {
      $set: {
        hiddenWidgetIds,
        pinnedWidgetIds,
        widgetOrder,
        widgetSizes,
        updatedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );
};

module.exports = {
  getPreferences,
  savePreferences
};
