import * as express from 'express';
import * as bodyParser from 'body-parser';
import { logger } from './utils/logger';

const app = express();
app.use(bodyParser.json());

app.get('/health', (req, res) => {
	res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/', (req, res) => {
	res.send('Firewall Protocol backend running');
});

export default app;
