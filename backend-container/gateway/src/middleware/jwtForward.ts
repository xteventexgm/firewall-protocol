/**
 * Reenvía JWT a microservicios internos y opcionalmente resuelve X-User-Id vía identity.
 */
import type { NextFunction, Request, Response } from 'express';
import { IDENTITY_URL } from '../config/env';
import { logger } from '../utils/logger';

export async function jwtForwardMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    next();
    return;
  }

  // El proxy ya reenvía Authorization; añadimos X-User-Id si identity valida el token.
  try {
    const verifyRes = await fetch(`${IDENTITY_URL}/api/auth/verify`, {
      headers: { Authorization: auth },
    });
    if (verifyRes.ok) {
      const body = (await verifyRes.json()) as { valid?: boolean; userId?: string };
      if (body.valid && body.userId) {
        req.headers['x-user-id'] = body.userId;
      }
    }
  } catch (err) {
    logger.debug('JWT verify skipped (identity unreachable)', err);
  }

  next();
}
