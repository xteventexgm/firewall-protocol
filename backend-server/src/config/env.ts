import { DATA_DIR } from '../utils/constants';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number(process.env.PORT || 3000);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const DATA_DIRECTORY = process.env.DATA_DIRECTORY || DATA_DIR;

export default {
	NODE_ENV,
	PORT,
	LOG_LEVEL,
	DATA_DIRECTORY,
};
