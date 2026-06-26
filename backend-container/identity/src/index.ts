/**
 * API compartida para el monolito y otros microservicios.
 * El HTTP de auth vive en `server.ts`; este módulo exporta librerías reutilizables.
 */
export {
  isJwtConfigured,
  signAccessToken,
  verifyAccessToken,
  hashToken,
  newRefreshToken,
  type AccessTokenPayload,
} from './auth/jwt';
export { hashPassword, verifyPassword } from './auth/password';
export { validatePassword, validateUsername } from './auth/passwordPolicy';

export {
  registerUser,
  loginUser,
  getPublicUser,
  findUserById,
  linkGuestToUser,
  changeUsername,
  changeUserPassword,
  updateUserAvatarUrl,
  toPublicUser,
  isEmailVerified,
  type PublicUser,
  type UserDocument,
} from './services/UserService';

export {
  createAuthSession,
  rotateAuthSession,
  revokeAuthSession,
  type AuthSessionDocument,
} from './services/AuthSessionService';

export {
  listParticipationsByUser,
  recordGameParticipations,
  incrementUserStatsAfterGame,
} from './services/GameParticipationService';

export {
  connectMongo,
  getDb,
  isMongoEnabled,
  isMongoConnected,
  getMongoLastError,
} from './services/mongoConnection';
