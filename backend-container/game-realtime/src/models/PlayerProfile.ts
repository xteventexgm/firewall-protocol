/**
 * Modelo de jugador en memoria y en JSON persistido.
 *
 * Un jugador pertenece a `GameStateModel.players`. La cola de acciones nocturnas
 * vive a nivel de sala (`actionQueue`), no en el perfil del jugador.
 */
import { PlayerId, RoleId } from '../types';

/** Forma serializable del jugador (persistencia / tipos compartidos). */
export interface PlayerProfile {
  id: PlayerId;
  name: string;
  avatarUrl?: string;
  socketId?: string;
  role?: RoleId;
  team?: string;
  isAlive: boolean;
  isConnected: boolean;
  joinedAt: number;
  /** Flags por rol: cooldowns, infección, escudos, etc. Ver `player-metadata.types.ts`. */
  metadata?: Record<string, any>;
  /** Jugador simulado para QA (sin socket móvil). */
  isBot?: boolean;
  /** Vínculo a cuenta `users` cuando el jugador inició sesión. */
  userId?: string;
  /** Indicador de si el jugador ha confirmado estar listo en el lobby. */
  isReady?: boolean;
}

/** Instancia mutable de jugador en runtime. */
export class Player implements PlayerProfile {
  id: PlayerId;
  name: string;
  avatarUrl?: string;
  socketId?: string;
  role?: RoleId;
  team?: string;
  isAlive = true;
  isConnected = true;
  joinedAt: number;
  metadata?: Record<string, any>;
  isBot?: boolean;
  /** Vínculo a cuenta `users` cuando el jugador inició sesión. */
  userId?: string;
  isReady?: boolean;
  /** 'transport' = caída de socket; 'voluntary' = salió con leaveRoom. */
  lastDisconnectReason?: 'voluntary' | 'transport';

  constructor(id: PlayerId, name: string, socketId?: string) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.joinedAt = Date.now();
  }
}
