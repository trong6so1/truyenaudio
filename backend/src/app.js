const express = require('express');
const path = require('path');
const config = require('./config');
const storyRoutes = require('./routes/storyRoutes');

const app = express();

// Security headers & method allow-list middleware
app.use((req, res, next) => {
  const allowedMethods = ['GET', 'POST', 'HEAD', 'OPTIONS'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
  );
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Simple rate limiter per IP
const rateLimitMap = new Map();
app.use('/api', (req, res, next) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 120;
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  rateLimitMap.set(ip, record);
  if (record.count > maxRequests) {
    return res.status(429).json({ error: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' });
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// Serve static frontend files
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// Mount API routes
app.use('/api', storyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'truyenaudio-backend' });
});

if (require.main === module) {
  app.listen(config.PORT, config.HOST, () => {
    console.log(`Story-to-Audio Server listening on http://${config.HOST}:${config.PORT}`);
  });
}

module.exports = app;
