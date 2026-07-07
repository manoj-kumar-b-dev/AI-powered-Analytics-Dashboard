require('dotenv').config();
const mongoose = require('mongoose');
const Analytics = require('./src/models/analytics');

async function clearCache() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    const result = await Analytics.deleteMany({});
    console.log(`Deleted ${result.deletedCount} cached analytics documents.`);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
clearCache();