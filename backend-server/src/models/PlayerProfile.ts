import { PlayerAction, PlayerId, RoleId } from '../types';

export interface PlayerProfile {
  id: PlayerId;
  name: string;
  socketId?: string;
  role?: RoleId;
  team?: string;
  isAlive: boolean;
  isConnected: boolean;
  joinedAt: number; // epoch ms
  metadata?: Record<string, any>;
  pendingActions?: PlayerAction[];
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
  pendingActions: PlayerAction[] = [];

  constructor(id: PlayerId, name: string, socketId?: string) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.joinedAt = Date.now();
  }

  addAction(action: PlayerAction) {
    this.pendingActions = this.pendingActions || [];
    this.pendingActions.push(action);
  }

  clearActions() {
    this.pendingActions = [];
  }
}