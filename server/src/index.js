require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const port = process.env.PORT || 5002;

// Behind Cloudflare + the Next.js rewrite; requests arrive same-origin, so no CORS.
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// Test endpoint
app.get('/', (req, res) => {
  res.send('IRON RISK Server is running');
});

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Errors raised before a router handles the request (e.g. malformed JSON body).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('Unhandled error:', req.method, req.originalUrl, err);
  res.status(status).json({ error: status === 400 ? 'รูปแบบข้อมูลไม่ถูกต้อง' : 'เกิดข้อผิดพลาดในระบบ' });
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
