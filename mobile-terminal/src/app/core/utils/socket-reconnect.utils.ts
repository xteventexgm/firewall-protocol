/** Opciones Socket.IO compartidas — reintento indefinido hasta que el backend responda. */
export function socketReconnectOptions(): {
  transports: ('polling' | 'websocket')[];
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  timeout: number;
} {
  return {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 12_000,
    timeout: 15_000,
  };
}
