/**
 * Producción (APK): IP del backend en la misma red que los móviles.
 * Cambia apiUrl antes de generar el APK si tu servidor usa otra IP.
 */
export const environment = {
  production: true,
  apiUrl: 'http://192.168.137.1:3000',
  socketNamespace: '/game',
};
