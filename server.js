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
  origin:"*",
  // origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

/* ── Rate limiting ───────────────────────────────────────────── */
// Strict limit on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

// General API limit. Practice grades one card at a time, so a single
// 25-card session is ~25 requests — 300 per 15 minutes was low enough that
// a committed learner could 429 themselves mid-session.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      1500,
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
const server = app.listen(PORT, () => {
  console.log(`\n🦊 KitsuSpeak backend running on port ${PORT}`);
  console.log(`   ENV:    ${process.env.NODE_ENV}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

/* ══════════════════════════════════════════════════════════════
   STAYING UP
   Node kills the process on an unhandled 'error' event, an uncaught
   throw, or (since v15) an unhandled promise rejection. None of those
   used to be handled here, so one stray throw in a callback — or just
   starting twice on the same port — took the API down with a stack
   trace and no explanation.
══════════════════════════════════════════════════════════════ */

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Another copy of the server is probably still running:`);
    console.error(`   lsof -nP -iTCP:${PORT} -sTCP:LISTEN\n`);
    process.exit(1); // nothing to recover from — the port belongs to someone else
  }
  console.error(`❌ Server error: ${err.message}`);
});

/* A rejected promise nobody awaited is a bug in one request, not a reason
   to drop every other connection. Log it loudly and keep serving. */
process.on('unhandledRejection', reason => {
  console.error('💥 Unhandled promise rejection:', reason instanceof Error ? reason.stack : reason);
});

/* An uncaught exception leaves the process in an officially undefined state,
   and the textbook answer is to exit. For a single-instance app with no
   supervisor that just means downtime, and in practice these are almost
   always one bad request rather than corrupted global state — so we log and
   stay up. Run under a process manager (pm2, systemd, a container restart
   policy) if you would rather it restart clean. */
process.on('uncaughtException', err => {
  console.error('💥 Uncaught exception:', err.stack || err);
});

/* Finish in-flight requests instead of severing them on redeploy. */
const shutdown = signal => () => {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));

module.exports = app;
