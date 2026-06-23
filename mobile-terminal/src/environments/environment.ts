/**
 * Desarrollo (ionic serve).
 * Debe apuntar al mismo host/puerto que el backend (`npm run dev` en backend-server).
 * Con ngrok: ngrok http 3000 → copia la URL https aquí (sin puerto).
 */
export const environment = {
  production: false,
  /** URL base del backend (HTTP + Socket.io). Ej: http://localhost:3000 */
  apiUrl: 'http://localhost:3000',
  socketNamespace: '/game',
};
