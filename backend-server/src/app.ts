import express from 'express';
import bodyParser from 'body-parser';
import { logger } from './utils/logger';

const app = express();
app.use(bodyParser.json());

app.get('/health', (req: express.Request, res: express.Response) => {
	res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/', (req: express.Request, res: express.Response) => {
	res.send('Firewall Protocol backend running');
});

export default app;
