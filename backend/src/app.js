require('dotenv').config(); // Reloaded config
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('passport');

const configurePassport = require('./config/passport');
const { tenantMiddleware } = require('./middleware/tenantContext');
const authRouter = require('./routes/auth');
const orgRouter = require('./routes/org');
const dataSourceRouter = require('./routes/dataSource');
const analyticsRouter = require('./routes/analytics');
const dashboardAnalyticsRouter = require('./routes/dashboardAnalytics');
const insightsRouter = require('./routes/insights');
const datasetRouter = require('./routes/datasetRoutes');

const app = express();

// CORS config matching frontend URL
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176'
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, postman, or same-origin requests)
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https?:\/\/localhost:\d+$/.test(origin) ||
        /\.vercel\.app$/.test(origin);
      if (isAllowed) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Passport Init
configurePassport();
app.use(passport.initialize());

// Tenant Context Middleware (runs after auth)
app.use(tenantMiddleware);

// Database Connection Helper & Middleware (Serverless Friendly)
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas_analytics';
  await mongoose.connect(dbUri);
};

app.use(async (req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    try {
      await connectDB();
    } catch (err) {
      console.error('MongoDB connection error:', err.message || err);
      return res.status(500).json({
        error: {
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Failed to connect to database. Please verify MONGO_URI in Vercel Environment Variables.'
        }
      });
    }
  }
  next();
});

// REST Endpoints
app.use('/auth', authRouter);
app.use('/orgs', orgRouter);
app.use('/datasources', dataSourceRouter);
app.use('/analytics', analyticsRouter);
app.use('/dashboard', dashboardAnalyticsRouter);
app.use('/insights', insightsRouter);
app.use('/api/datasets', datasetRouter);
app.use('/datasets', datasetRouter);

// Root and favicon routes to prevent 404s in browser direct access
app.get('/', (req, res) => res.status(200).json({ message: 'SaaS Analytics API Backend Running' }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/*', (req, res) => res.status(204).end());

// Base route for healthcheck
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.url}`
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  return res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred on the server'
    }
  });
});

// Bind Port
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
