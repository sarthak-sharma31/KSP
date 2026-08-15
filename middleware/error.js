/* ── Global error handler ────────────────────────────────────── */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Server Error';

  // Something already started writing the response — anything we add here
  // throws "Cannot set headers after they are sent", which escapes as an
  // uncaught exception. Hand it to Express so it closes the socket.
  if (res.headersSent) return next(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    message    = `Resource not found`;
    statusCode = 404;
  }

  // Mongoose duplicate key. `keyValue` is absent on some driver versions and
  // on bulk errors, and Object.keys(undefined) would throw *inside* the
  // error handler — the one place a throw is guaranteed to be uncaught.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0];
    message    = field
      ? `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
      : 'That record already exists';
    statusCode = 400;
  }

  // Malformed JSON body / oversized payload — a client mistake, not a 500.
  if (err.type === 'entity.parse.failed') {
    message    = 'Invalid JSON body';
    statusCode = 400;
  }
  if (err.type === 'entity.too.large') {
    message    = 'Request body too large';
    statusCode = 413;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message    = Object.values(err.errors).map(e => e.message).join('. ');
    statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  { message = 'Invalid token';  statusCode = 401; }
  if (err.name === 'TokenExpiredError')  { message = 'Token expired';  statusCode = 401; }

  if (statusCode >= 500) {
    console.error(`💥 ${req.method} ${req.originalUrl} — ${err.stack || err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/* ── Async wrapper — no try/catch needed in controllers ─────── */
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
