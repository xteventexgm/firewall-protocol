/**
 * Eliminación permanente de cuenta: datos Mongo, sesiones, tokens y avatar (R2/disco).
 */
import { revokeAllUserSessions } from './AuthSessionService';
import { consumeEmailToken, deleteEmailTokensForUser } from './EmailTokenService';
import { deleteParticipationsByUser } from './GameParticipationService';
import { deleteUserAvatarStorage } from './mediaClient';
import { deleteUserAccount, findUserById, verifyUserPassword } from './UserService';
import { logger } from '../utils/logger';

export async function performAccountDeletion(userId: string): Promise<void> {
  const doc = await findUserById(userId);
  if (!doc) throw new Error('user_not_found');

  await deleteUserAvatarStorage(userId);
  await deleteParticipationsByUser(userId);
  await deleteEmailTokensForUser(userId);
  await revokeAllUserSessions(userId);
  await deleteUserAccount(userId);

  logger.info('[identity] cuenta eliminada', { userId, username: doc.username });
}

export async function confirmAccountDeletion(
  userId: string,
  password: string,
  rawToken: string,
): Promise<void> {
  const tokenUserId = await consumeEmailToken(rawToken, 'delete_account');
  if (!tokenUserId || tokenUserId !== userId) {
    throw new Error('invalid_delete_token');
  }
  const valid = await verifyUserPassword(userId, password);
  if (!valid) throw new Error('invalid_current_password');
  await performAccountDeletion(userId);
}
