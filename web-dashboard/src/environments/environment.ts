/**
 * Desarrollo (`ng serve`).
 * Debe apuntar al mismo host/puerto que el backend (`npm run dev` en backend-server).
 */
export const environment = {
  production: false,
  /** URL base del backend (HTTP + Socket.io). Ej: http://localhost:3000 */
  apiUrl: 'https://firewall-protocol.onrender.com',
  socketNamespace: '/dashboard',
};
