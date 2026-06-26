import express from 'express';
import bodyParser from 'body-parser';
import mediaRoutes from './routes/media.routes';
import { getAvatarStorageMode } from './services/AvatarService';
import {
  ensureObjectStorageBucket,
  getObjectStorageLastError,
  getObjectStorageProvider,
  isObjectStorageConnected,
  isObjectStorageEnabled,
} from './services/objectStorageClient';
import { S3_BUCKET, S3_ENDPOINT } from './config/env';

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-User-Id, ngrok-skip-browser-warning, Bypass-Tunnel-Reminder',
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(bodyParser.json());
app.use('/api/media', mediaRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'media',
    ts: new Date().toISOString(),
    avatars: {
      storage: getAvatarStorageMode(),
      objectStorage: isObjectStorageEnabled()
        ? {
            provider: getObjectStorageProvider(),
            configured: true,
            connected: isObjectStorageConnected(),
            endpoint: S3_ENDPOINT,
            bucket: S3_BUCKET,
            error: !isObjectStorageConnected() ? getObjectStorageLastError() : null,
          }
        : { configured: false },
    },
  });
});

export default app;
