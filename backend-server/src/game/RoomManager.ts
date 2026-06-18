import Room from './Room';
import { Player } from '../models/PlayerProfile';
import { attachRoomBridge } from '../sockets/roomBridge';
import { Namespace } from 'socket.io';
import database from '../config/database';
import { logRoom } from '../utils/socketLog';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(id: string, options?: any, gameNs?: Namespace, dashboardNs?: Namespace) {
    if (this.rooms.has(id)) throw new Error('Room already exists');
    const r = new Room(id, options);
    if (gameNs) attachRoomBridge(r, gameNs, dashboardNs);
    this.rooms.set(id, r);

    const saved = database.save(id, r.state.toPlain());
    logRoom('created', id, {
      phase: r.state.phase,
      players: r.state.players.length,
      persisted: saved,
    });

    return r;
  }

  ensureBridge(room: Room, gameNs: Namespace, dashboardNs?: Namespace) {
    attachRoomBridge(room, gameNs, dashboardNs);
    logRoom('bridge attached', room.id);
  }

  getRoom(id: string) {
    return this.rooms.get(id) || null;
  }

  deleteRoom(id: string) {
    const r = this.rooms.get(id);
    if (!r) return false;
    r.destroy();
    this.rooms.delete(id);
    logRoom('deleted from memory', id);
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
