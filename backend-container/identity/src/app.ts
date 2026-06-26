/**
 * Aplicación Express del servicio de identidad.
 */
import express from 'express';
import bodyParser from 'body-parser';
import authRoutes from './routes/auth.routes';
import { isJwtConfigured } from './auth/jwt';
import { isMongoConnected, isMongoEnabled, getMongoLastError } from './services/mongoConnection';

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, ngrok-skip-browser-warning, Bypass-Tunnel-Reminder',
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(bodyParser.json());
app.use('/api/auth', authRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'identity',
    ts: new Date().toISOString(),
    mongodb: {
      configured: isMongoEnabled(),
      connected: isMongoConnected(),
      error: isMongoEnabled() && !isMongoConnected() ? getMongoLastError() : null,
    },
    auth: {
      enabled: isMongoEnabled() && isJwtConfigured(),
      guestPlayAllowed: true,
    },
  });
});

app.get('/', (_req, res) => {
  res.send('Firewall Protocol identity service');
});

export default app;
