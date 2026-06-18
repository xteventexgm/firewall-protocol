import Room from './Room';
import { Player } from '../models/PlayerProfile';
import { attachRoomBridge } from '../sockets/roomBridge';
import { Namespace } from 'socket.io';
import database from '../config/database';
import { logRoom } from '../utils/socketLog';
import { GamePhase } from '../types';

export class RoomClosedError extends Error {
  constructor(message = 'Room has ended') {
    super(message);
    this.name = 'RoomClosedError';
  }
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  private normalizeId(id: string) {
    return id.trim().toUpperCase();
  }

  private assertJoinablePhase(phase: GamePhase, roomId: string) {
    if (phase === GamePhase.FIN) {
      throw new RoomClosedError(`Room ${roomId} has ended`);
    }
  }

  /** Solo dashboard: sala nueva, sin JSON previo ni sala en memoria. */
  createRoom(id: string, options?: any, gameNs?: Namespace, dashboardNs?: Namespace) {
    const roomId = this.normalizeId(id);
    if (this.rooms.has(roomId)) throw new Error('Room already exists');

    const persisted = database.load(roomId);
    if (persisted) {
      if (persisted.phase === GamePhase.FIN) {
        throw new Error('Room code already used (game finished). Create a new lobby.');
      }
      throw new Error('Room code already in use. Create a new lobby.');
    }

    const r = new Room(roomId, { ...options, restore: false });
    if (gameNs) attachRoomBridge(r, gameNs, dashboardNs);
    this.rooms.set(roomId, r);

    const saved = database.save(roomId, r.state.toPlain());
    logRoom('created', roomId, {
      phase: r.state.phase,
      players: r.state.players.length,
      persisted: saved,
    });

    return r;
  }

  /**
   * Une a sala activa en memoria o restaura desde JSON (reinicio del servidor).
   * No crea salas nuevas.
   */
  getOrRestoreRoom(id: string, gameNs?: Namespace, dashboardNs?: Namespace): Room | null {
    const roomId = this.normalizeId(id);
    const inMemory = this.rooms.get(roomId);
    if (inMemory) {
      this.assertJoinablePhase(inMemory.state.phase, roomId);
      if (gameNs) this.ensureBridge(inMemory, gameNs, dashboardNs);
      return inMemory;
    }

    const persisted = database.load(roomId);
    if (!persisted) return null;

    this.assertJoinablePhase(persisted.phase as GamePhase, roomId);

    const r = new Room(roomId, { restore: true });
    if (gameNs) attachRoomBridge(r, gameNs, dashboardNs);
    this.rooms.set(roomId, r);
    logRoom('restored from disk', roomId, {
      phase: r.state.phase,
      players: r.state.players.length,
    });
    return r;
  }

  ensureBridge(room: Room, gameNs: Namespace, dashboardNs?: Namespace) {
    attachRoomBridge(room, gameNs, dashboardNs);
    logRoom('bridge attached', room.id);
  }

  getRoom(id: string) {
    return this.rooms.get(this.normalizeId(id)) || null;
  }

  deleteRoom(id: string) {
    const roomId = this.normalizeId(id);
    const r = this.rooms.get(roomId);
    if (!r) return false;
    r.destroy();
    this.rooms.delete(roomId);
    logRoom('deleted from memory', roomId);
    return true;
  }

  listRooms() {
    return Array.from(this.rooms.keys());
  }

  findPlayerBySocketId(socketId: string): { room: Room; player: Player } | null {
    for (const room of this.rooms.values()) {
      const player = room.state.players.find(p => p.socketId === socketId);
      if (player) return { room, player };
    }
    return null;
  }
}

export default new RoomManager();
