const mongoose = require('mongoose');

/* A dropped or briefly-unavailable database is an outage, not a reason to
   kill the process. The old version called process.exit(1) the moment the
   first connect failed, so starting the API a second before Mongo was ready
   — or a five-second network blip on Atlas — took the whole server down and
   left it down. Now we keep retrying with backoff and let the driver's own
   buffering hold requests while a reconnect is in flight. */

const MAX_DELAY_MS = 30_000;
const BASE_DELAY_MS = 1_000;

let attempt = 0;
let connecting = false;

const delayFor = n => Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** n);

async function connectDB() {
  if (connecting || mongoose.connection.readyState === 1) return;
  connecting = true;

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    attempt = 0;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    const wait = delayFor(attempt);
    attempt += 1;
    console.error(`❌ MongoDB connection error (attempt ${attempt}): ${err.message}`);
    console.error(`   retrying in ${Math.round(wait / 1000)}s`);
    setTimeout(() => { connectDB(); }, wait).unref();
  } finally {
    connecting = false;
  }
}

/* Mongoose emits these on its own after the initial connect; without
   listeners an 'error' event on the connection is an unhandled error event,
   which terminates the process. */
mongoose.connection.on('error', err => {
  console.error(`❌ MongoDB error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected — the driver will keep retrying.');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

module.exports = connectDB;
