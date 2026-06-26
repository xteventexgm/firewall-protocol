/**
 * Gateway Express — enruta tráfico HTTP y WebSocket a los microservicios.
 */
import express from 'express';
import type { Request, Response } from 'express';
import { createProxyMiddleware, type Options } from 'http-proxy-middleware';
import { GAME_REALTIME_URL, IDENTITY_URL, MEDIA_URL } from './config/env';
import { jwtForwardMiddleware } from './middleware/jwtForward';
import { logger } from './utils/logger';

const app = express();

const CORS_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-User-Id',
  'ngrok-skip-browser-warning',
  'Bypass-Tunnel-Reminder',
] as const;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS.join(', '));
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

/** Socket.IO: no bloquear polling ni upgrade con verificación JWT async */
function isSocketIoTraffic(url: string): boolean {
  return (
    url.startsWith('/socket.io') ||
    url.startsWith('/game') ||
    url.startsWith('/dashboard')
  );
}

app.use((req, res, next) => {
  if (isSocketIoTraffic(req.url ?? '') || (req.url ?? '').startsWith('/api/auth/avatars')) {
    next();
    return;
  }
  void jwtForwardMiddleware(req, res, next);
});

function proxyLog(target: string): Options['on'] {
  return {
    proxyReq: (proxyReq, req) => {
      const auth = req.headers.authorization;
      if (auth) proxyReq.setHeader('Authorization', auth);
      const userId = req.headers['x-user-id'];
      if (typeof userId === 'string') proxyReq.setHeader('X-User-Id', userId);
      logger.debug(`→ ${target}${req.url}`, { method: req.method });
    },
    error: (err, req, res) => {
      logger.error(`Proxy error ${req.url}`, err);
      if (res && 'writeHead' in res && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad gateway', code: 'gateway_proxy_error' }));
      }
    },
  };
}

const identityProxy = createProxyMiddleware({
  target: IDENTITY_URL,
  changeOrigin: true,
  pathRewrite: (path) => `/api/auth${path}`,
  on: proxyLog('identity'),
});

const mediaProxy = createProxyMiddleware({
  target: MEDIA_URL,
  changeOrigin: true,
  pathRewrite: (path) => `/api/media${path}`,
  on: proxyLog('media'),
});

const legacyAvatarProxy = createProxyMiddleware({
  target: MEDIA_URL,
  changeOrigin: true,
  pathRewrite: (path) => `/api/media/avatar${path}`,
  on: proxyLog('media/legacy-avatar'),
});

const legacyAvatarsProxy = createProxyMiddleware({
  target: MEDIA_URL,
  changeOrigin: true,
  pathRewrite: (path) => `/api/media/avatars${path}`,
  on: proxyLog('media/legacy-avatars'),
});

/**
 * Socket.IO + namespaces — pathFilter preserva /socket.io/ completo (sin strip de Express).
 * El cliente conecta a http://host:3000/game → polling en /socket.io/?EIO=4...
 */
const gameRealtimeSocketProxy = createProxyMiddleware({
  target: GAME_REALTIME_URL,
  changeOrigin: true,
  ws: true,
  pathFilter: (pathname) => isSocketIoTraffic(pathname),
  on: proxyLog('game-realtime/socket'),
});

/** REST del juego (excluye tráfico Socket.IO) */
const gameRealtimeHttpProxy = createProxyMiddleware({
  target: GAME_REALTIME_URL,
  changeOrigin: true,
  pathFilter: (pathname) => !isSocketIoTraffic(pathname),
  on: proxyLog('game-realtime/http'),
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'gateway',
    ts: new Date().toISOString(),
    routes: {
      auth: `${IDENTITY_URL}/api/auth/*`,
      media: `${MEDIA_URL}/api/media/*`,
      socketIo: `${GAME_REALTIME_URL}/socket.io/*`,
      gameSockets: `${GAME_REALTIME_URL}/game`,
      dashboardSockets: `${GAME_REALTIME_URL}/dashboard`,
    },
  });
});

app.use('/api/media', mediaProxy);
app.use('/api/auth/avatar', legacyAvatarProxy);
app.use('/api/auth/avatars', legacyAvatarsProxy);
app.use('/api/auth', identityProxy);

/** Socket.IO — debe ir antes del proxy HTTP catch-all */
app.use(gameRealtimeSocketProxy);
app.use(gameRealtimeHttpProxy);

export { app, gameRealtimeSocketProxy };
export default app;
