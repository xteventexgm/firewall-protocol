import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getNightActionType } from '../../core/role-actions';

export type GamePhase =
  | 'LOBBY'
  | 'REPARTO'
  | 'NOCHE'
  | 'DIA'
  | 'VOTACION'
  | 'VERIFICACION'
  | 'FIN';

export interface PlayerView {
  name: string;
  role: string;
  roleId?: string;
  team?: string;
  teamLabel?: string;
  roleDescription?: string;
  nightActionHint?: string;
  isDead: boolean;
  silenced?: boolean;
}

export interface TargetOption {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private listenersAttached = false;

  readonly gameState$ = new Subject<{ phase: GamePhase; players: any[]; roomId: string }>();
  readonly playerState$ = new Subject<PlayerView>();
  readonly privateResult$ = new Subject<any>();
  readonly error$ = new Subject<string>();
  readonly actionAccepted$ = new Subject<string>();

  private myRole: string | undefined;
  private myTeam: string | undefined;

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(`${environment.apiUrl}/game`, {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => console.log('[socket] conectado'));
    this.socket.on('disconnect', () => console.log('[socket] desconectado'));
    this.attachListeners();
  }

  joinRoom(roomId: string, playerId: string, name: string): void {
    this.connect();
    const code = roomId.toUpperCase().trim();

    localStorage.setItem('roomCode', code);
    localStorage.setItem('myPlayerId', playerId);
    localStorage.setItem('playerName', name);

    this.socket?.emit('joinRoom', code, playerId, name);
  }

  submitNightAction(targetId: string): boolean {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    if (!roomId || !playerId || !this.socket?.connected) return false;

    const type = getNightActionType(this.myRole);
    if (!type) {
      this.error$.next('Tu rol no tiene acción nocturna');
      return false;
    }

    const action = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      actor: playerId,
      role: this.myRole,
      type,
      target: targetId,
      timestamp: Date.now(),
    };

    this.socket.emit('playerAction', roomId, action);
    return true;
  }

  submitVote(targetId: string | null): boolean {
    const roomId = localStorage.getItem('roomCode');
    const voter = localStorage.getItem('myPlayerId');
    if (!roomId || !voter || !this.socket?.connected) return false;

    this.socket.emit('submitVote', roomId, { voter, target: targetId });
    return true;
  }

  getMyRole(): string | undefined {
    return this.myRole;
  }

  private attachListeners(): void {
    if (!this.socket || this.listenersAttached) return;
    this.listenersAttached = true;

    this.socket.on('roomState', (roomId: string, state: any) => {
      const myPlayerId = localStorage.getItem('myPlayerId');
      this.gameState$.next({
        roomId,
        phase: state.phase,
        players: state.players ?? [],
      });

      if (myPlayerId && state.players) {
        const me = state.players.find((p: any) => p.id === myPlayerId);
        if (me) {
          this.playerState$.next({
            name: me.name,
            role: this.myRole ?? me.role ?? 'ESPERANDO ASIGNACIÓN',
            team: this.myTeam ?? me.team,
            isDead: !me.isAlive,
            silenced: me.metadata?.silencedUntilDay != null,
          });
        }
      }
    });

    this.socket.on('privateResult', (roomId: string, payload: any) => {
      this.privateResult$.next({ roomId, ...payload });

      if (payload.type === 'role_assigned') {
        this.myRole = payload.role;
        this.myTeam = payload.team;
        const name = localStorage.getItem('playerName') ?? '';
        this.playerState$.next({
          name,
          role: payload.displayName ?? payload.role,
          roleId: payload.role,
          team: payload.team,
          teamLabel: payload.teamLabel,
          roleDescription: payload.description,
          nightActionHint: payload.nightActionHint,
          isDead: false,
        });
      }
    });

    this.socket.on('actionAccepted', (actionId: string) => {
      this.actionAccepted$.next(actionId);
    });

    this.socket.on('error', (msg: string) => {
      this.error$.next(msg);
    });

    this.socket.on('gameOver', () => {
      this.error$.next('Partida terminada');
    });
  }
}
