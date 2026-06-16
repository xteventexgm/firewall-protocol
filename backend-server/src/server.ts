import * as http from 'http';
import app from './app';
import initSockets from './sockets';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

const io = initSockets(server as any);

server.listen(PORT, () => {
	logger.info(`Server listening on port ${PORT}`);
});

export default server;
