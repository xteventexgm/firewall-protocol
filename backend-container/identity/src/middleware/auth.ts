import { Request, Response } from 'express';
import { isJwtConfigured, verifyAccessToken } from '../auth/jwt';
import { isMongoEnabled } from '../services/mongoConnection';

export function bearerUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const payload = verifyAccessToken(header.slice(7));
  return payload?.sub ?? null;
}

export function authUnavailable(res: Response): boolean {
  if (!isMongoEnabled()) {
    res.status(503).json({
      error: 'Autenticación requiere MongoDB. Configura MONGO_URI.',
      code: 'auth_requires_mongodb',
    });
    return true;
  }
  if (!isJwtConfigured()) {
    res.status(503).json({
      error: 'Autenticación deshabilitada: falta JWT_SECRET',
      code: 'auth_requires_jwt_secret',
    });
    return true;
  }
  return false;
}
