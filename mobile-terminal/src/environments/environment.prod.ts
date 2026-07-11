/**
 * Producción (APK): URL del backend accesible desde el móvil.
 * Misma WiFi: http://192.168.x.x:3000 (recomendado para APK en LAN).
 * Remoto: https://xxxx.ngrok-free.dev (actualiza al reiniciar ngrok).
 */
export const environment = {
  production: true,
  apiUrl: 'https://firewall-protocol.shares.zrok.io',
  socketNamespace: '/game',
};
