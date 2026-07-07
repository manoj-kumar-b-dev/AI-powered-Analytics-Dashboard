// Repositories layer barrel file. In subsequent phases, MongoDB access methods will be exported from here.
const datasetRepository = require('./datasetRepository');
const dashboardPreferenceRepository = require('./dashboardPreferenceRepository');

module.exports = {
  datasetRepository,
  dashboardPreferenceRepository
};
