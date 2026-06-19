/**
 * Aplicación Express mínima del backend.
 * Expone `/health` (monitorización) y `/` (confirmación de servicio).
 * La lógica realtime vive en Socket.io (`server.ts` → `sockets/`).
 */
import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

app.get('/health', (req: express.Request, res: express.Response) => {
	res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/', (req: express.Request, res: express.Response) => {
	res.send('Firewall Protocol backend running');
});

export default app;
