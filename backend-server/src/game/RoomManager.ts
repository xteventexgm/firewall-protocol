import Room from './Room';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(id: string, options?: any) {
    if (this.rooms.has(id)) throw new Error('Room already exists');
    const r = new Room(id, options);
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
}

export default new RoomManager();
