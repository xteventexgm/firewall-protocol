/**
 * Llamadas internas al servicio media (avatares en disco / R2).
 */
import { INTERNAL_SERVICE_KEY, MEDIA_URL } from '../config/env';
import { logger } from '../utils/logger';

export async function deleteUserAvatarStorage(userId: string): Promise<void> {
  if (!MEDIA_URL) {
    logger.warn('[identity] MEDIA_URL no configurado — avatar no eliminado en storage', { userId });
    return;
  }
  try {
    const res = await fetch(`${MEDIA_URL}/api/media/internal/avatars/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'X-Internal-Service': 'identity',
        'X-Internal-Service-Key': INTERNAL_SERVICE_KEY,
      },
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      logger.error('[identity] fallo al eliminar avatar en media', { userId, status: res.status, body });
    }
  } catch (err) {
    logger.error('[identity] media inalcanzable al eliminar avatar', { userId, err });
  }
}
