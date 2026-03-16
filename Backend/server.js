const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const crypto = require('crypto');
const path = require('path');

// Load env FIRST so Clerk picks up the secret key
dotenv.config();

const { clerkMiddleware } = require('@clerk/express');
const { globalLimiter } = require('./middleware/rateLimiter');

// Import routes
const emailUserRoutes = require('./routes/emailUserRoutes');
const adminRoutes = require('./routes/adminRoutes');
const alumniRoutes = require('./routes/alumniRoutes');
const accommodationRoutes = require('./routes/accommodationRoutes');
const courseRoutes = require('./routes/courseRoutes');
const referralRoutes = require('./routes/referralRoutes');
const validationRoutes = require('./routes/validationRoutes');
const serverRoutes = require('./routes/serverRoutes');
const videoRoutes = require('./routes/videoRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const postRoutes = require('./routes/postRoutes');
const materialRoutes = require('./routes/materialRoutes');

// Initialize Express app
const app = express();

// Render runs behind a reverse proxy; trust first proxy so req.ip and rate limits work correctly.
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Always allow localhost in development
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:3001');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(clerkMiddleware());   // must be before any routes that use getAuth()

// ── Body parsing — cap at 5 MB to prevent payload attacks ────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Global rate limit — 200 requests / 15 min per IP ─────────────────────────
app.use('/api', globalLimiter);

// Set JWT Secret if not in env
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'heystudentsdu-secret-key-dev';
  process.env.JWT_EXPIRE = '30d';
}

// Database connection
const mongoURI = process.env.MONGODB_URI;
console.log('Attempting to connect to MongoDB Atlas...');

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB Atlas Connected Successfully'))
  .catch(err => {
    console.log('MongoDB connection error:', err);
  });

// Routes
app.use('/api/email-users', emailUserRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/server', serverRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/materials', materialRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Hey Students DU API is running');
});

// Public health endpoint for uptime monitors (returns minimal data only)
app.get('/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const bucket = Math.floor(Date.now() / 60000); // rotates each minute
  const salt = process.env.HEALTH_ROUTE_SALT || 'heystudents-health';
  const beat = crypto
    .createHash('sha256')
    .update(`${salt}:${bucket}:${process.pid}`)
    .digest('hex')
    .slice(0, 20);

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.status(dbConnected ? 200 : 503).json({
    ok: dbConnected,
    service: 'heystudents-api',
    beat,
    ts: new Date().toISOString(),
  });
});

// 🔁 Keep-alive ping route (for GitHub Actions or uptime pingers)
app.get('/ping', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`[PING] ${new Date().toISOString()} - Ping received from ${ip}`);
  res.sendStatus(200);
});

// Port
const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
