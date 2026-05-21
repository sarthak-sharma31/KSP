require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const connectDB        = require('./config/db');
const routes           = require('./routes/index');
const { errorHandler } = require('./middleware/error');

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── Connect to MongoDB ──────────────────────────────────────── */
connectDB();

/* ── Security middleware ─────────────────────────────────────── */
app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

/* ── Rate limiting ───────────────────────────────────────────── */
// Strict limit on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

// General API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      300,
  message:  { success: false, message: 'Too many requests. Please slow down.' },
});

app.use('/api/auth',   authLimiter);
app.use('/api',        apiLimiter);

/* ── Body parser & logging ───────────────────────────────────── */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

/* ── Health check ────────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '🦊 KitsuSpeak API is running',
    env:     process.env.NODE_ENV,
    time:    new Date().toISOString(),
  });
});

/* ── API routes ──────────────────────────────────────────────── */
app.use('/api', routes);

/* ── 404 handler ─────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

/* ── Global error handler ────────────────────────────────────── */
app.use(errorHandler);

/* ── Start server ────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🦊 KitsuSpeak backend running on port ${PORT}`);
  console.log(`   ENV:    ${process.env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

module.exports = app;
