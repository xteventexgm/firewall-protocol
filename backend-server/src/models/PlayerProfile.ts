import { PlayerId, RoleId } from '../types';

export interface PlayerProfile {
  id: PlayerId;
  name: string;
  socketId?: string;
  role?: RoleId;
  team?: string;
  isAlive: boolean;
  isConnected: boolean;
  joinedAt: number;
  metadata?: Record<string, any>;
}

export class Player implements PlayerProfile {
  id: PlayerId;
  name: string;
  socketId?: string;
  role?: RoleId;
  team?: string;
  isAlive = true;
  isConnected = true;
  joinedAt: number;
  metadata?: Record<string, any>;

  constructor(id: PlayerId, name: string, socketId?: string) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.joinedAt = Date.now();
  }
}
