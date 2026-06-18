import { Namespace } from 'socket.io';
import Room from './Room';
import { Player } from '../models/PlayerProfile';
import { attachRoomBridge } from '../sockets/roomBridge';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(id: string, options?: any, ns?: Namespace) {
    if (this.rooms.has(id)) throw new Error('Room already exists');
    const r = new Room(id, options);
    if (ns) attachRoomBridge(r, ns);
    this.rooms.set(id, r);
    return r;
  }

  getRoom(id: string) {
    return this.rooms.get(id) || null;
  }

  deleteRoom(id: string) {
    const r = this.rooms.get(id);
    if (!r) return false;
    r.destroy();
    this.rooms.delete(id);
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
