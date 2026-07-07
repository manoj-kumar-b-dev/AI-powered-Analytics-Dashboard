require('dotenv').config();
const chartRecService = require('./src/services/chartRecommendation/chartRecommendationService');
const kpiRecService = require('./src/services/kpiRecommendation/kpiRecommendationService');

const mockSchema = [
  { column: 'date', type: 'date', sampleValues: ['2023-01-01', '2023-01-02'] },
  { column: 'revenue', type: 'numeric', sampleValues: [100, 200] },
  { column: 'category', type: 'categorical', sampleValues: ['Electronics', 'Clothing'] }
];

async function run() {
  console.log('Testing Chart Recommendations...');
  try {
    const charts = await chartRecService.recommendCharts(mockSchema, 'ecommerce');
    console.log('Charts:', JSON.stringify(charts, null, 2));
  } catch (err) {
    console.error('Chart Error:', err);
  }

  console.log('\nTesting KPI Recommendations...');
  try {
    const kpis = await kpiRecService.recommendKPIs(mockSchema, 'ecommerce');
    console.log('KPIs:', JSON.stringify(kpis, null, 2));
  } catch (err) {
    console.error('KPI Error:', err);
  }
}

run();
