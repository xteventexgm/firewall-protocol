import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getNightActionType } from '../../core/role-actions';
import {
  GameOverPayload,
  GamePhase,
  IncidentReport,
  NightResolution,
  PhaseTransition,
  PlayerRoomState,
  PlayerView,
  VoteTiedPayload,
  VoteTrace,
} from '../../core/models/game-state.model';
import {
  incidentsFromServerReport,
  isPlayerSilenced,
  sanitizeRoomState,
} from '../../core/utils/game.utils';

export type {
  GamePhase,
  GameOverPayload,
  IncidentReport,
  NightResolution,
  PhaseTransition,
  PlayerRoomState,
  PlayerView,
  RoomPlayer,
  TargetOption,
  VoteTiedPayload,
  VoteTrace,
} from '../../core/models/game-state.model';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private listenersAttached = false;

  private myRole: string | undefined;
  private myTeam: string | undefined;

  readonly connected$ = new BehaviorSubject<boolean>(false);
  readonly gameState$ = new BehaviorSubject<PlayerRoomState | null>(null);
  readonly playerState$ = new BehaviorSubject<PlayerView | null>(null);
  readonly privateResult$ = new Subject<any>();
  readonly error$ = new Subject<string>();
  readonly actionAccepted$ = new Subject<string>();
  readonly phaseChanged$ = new Subject<{ roomId: string; phase: GamePhase }>();
  readonly phaseTransition$ = new Subject<PhaseTransition>();
  readonly incidents$ = new Subject<IncidentReport[]>();
  readonly nightResolved$ = new Subject<{ roomId: string; resolution: NightResolution }>();
  readonly voteTrace$ = new Subject<VoteTrace>();
  readonly voteTied$ = new Subject<VoteTiedPayload>();
  readonly playerReconnected$ = new Subject<{ roomId: string; playerId: string }>();
  readonly playerDisconnected$ = new Subject<{ roomId: string; playerId: string }>();
  readonly playerEliminated$ = new Subject<{ roomId: string; playerId: string; reason: string }>();
  readonly gameOver$ = new Subject<GameOverPayload>();

  connect(): void {
    if (this.socket?.connected) return;

    if (this.socket && !this.socket.connected) {
      this.socket.connect();
      return;
    }

    const url = `${environment.apiUrl}${environment.socketNamespace}`;
    const socketOptions: Parameters<typeof io>[1] = {
      transports: ['websocket', 'polling'],
    };

    if (!environment.production) {
      socketOptions.extraHeaders = {
        'Bypass-Tunnel-Reminder': 'true',
      };
    }

    this.socket = io(url, socketOptions);

    this.socket.on('connect', () => {
      console.log('[socket] conectado');
      this.connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('[socket] desconectado');
      this.connected$.next(false);
    });

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

  reconnectFromStorage(): boolean {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    const name = localStorage.getItem('playerName');
    if (!roomId || !playerId || !name) return false;
    this.joinRoom(roomId, playerId, name);
    return true;
  }

  leaveRoom(): void {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    if (roomId && playerId) {
      this.socket?.emit('leaveRoom', roomId, playerId);
    }
  }

  submitNightAction(targetId: string, meta?: Record<string, unknown>): boolean {
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
      ...(meta ? { meta } : {}),
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

  getMyTeam(): string | undefined {
    return this.myTeam;
  }

  clearSession(): void {
    this.leaveRoom();
    localStorage.removeItem('roomCode');
    localStorage.removeItem('playerName');
    this.gameState$.next(null);
    this.playerState$.next(null);
    this.myRole = undefined;
    this.myTeam = undefined;
  }

  private getActiveRoomId(): string | null {
    return localStorage.getItem('roomCode');
  }

  private isActiveRoom(roomId: string): boolean {
    const active = this.getActiveRoomId();
    return !active || roomId === active;
  }

  private attachListeners(): void {
    if (!this.socket || this.listenersAttached) return;
    this.listenersAttached = true;

    this.socket.on('roomState', (roomId: string, state: any) => {
      if (!this.isActiveRoom(roomId)) return;

      const sanitized = sanitizeRoomState({ ...state, roomId });
      this.gameState$.next(sanitized);

      const myPlayerId = localStorage.getItem('myPlayerId');
      if (myPlayerId) {
        const me = state.players?.find((p: any) => p.id === myPlayerId);
        if (me) {
          const current = this.playerState$.value;
          this.playerState$.next({
            name: me.name,
            role: current?.roleId ? current.role : (this.myRole ?? me.role ?? 'ESPERANDO ASIGNACIÓN'),
            roleId: current?.roleId ?? this.myRole ?? me.role,
            team: this.myTeam ?? me.team,
            teamLabel: current?.teamLabel,
            roleDescription: current?.roleDescription,
            nightActionHint: current?.nightActionHint,
            isDead: !me.isAlive,
            silenced: isPlayerSilenced(me, sanitized.dayNumber),
            isConnected: me.isConnected !== false,
          });
        }
      }
    });

    this.socket.on('privateResult', (_roomId: string, payload: any) => {
      this.privateResult$.next(payload);

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
          silenced: false,
        });
      }
    });

    this.socket.on('phaseChanged', (roomId: string, phase: GamePhase) => {
      if (!this.isActiveRoom(roomId)) return;
      this.phaseChanged$.next({ roomId, phase });
    });

    this.socket.on('phaseTransition', (transition: PhaseTransition) => {
      if (!this.isActiveRoom(transition.roomId)) return;
      this.phaseTransition$.next(transition);
    });

    this.socket.on('incidentReport', (report: { roomId: string; disconnected: string[] }) => {
      if (!this.isActiveRoom(report.roomId)) return;
      const incidents = incidentsFromServerReport(report.disconnected, this.gameState$.value);
      if (incidents.length) this.incidents$.next(incidents);
    });

    this.socket.on('nightResolved', (roomId: string, resolution: NightResolution) => {
      if (!this.isActiveRoom(roomId)) return;
      this.nightResolved$.next({ roomId, resolution });
    });

    this.socket.on('voteTrace', (trace: VoteTrace) => {
      if (!this.isActiveRoom(trace.roomId)) return;
      this.voteTrace$.next(trace);
    });

    this.socket.on('voteTied', (payload: VoteTiedPayload) => {
      if (!this.isActiveRoom(payload.roomId)) return;
      this.voteTied$.next(payload);
    });

    this.socket.on('playerReconnected', (roomId: string, playerId: string) => {
      if (!this.isActiveRoom(roomId)) return;
      this.playerReconnected$.next({ roomId, playerId });
    });

    this.socket.on('playerDisconnected', (roomId: string, playerId: string) => {
      if (!this.isActiveRoom(roomId)) return;
      this.playerDisconnected$.next({ roomId, playerId });
    });

    this.socket.on('playerEliminated', (roomId: string, playerId: string, reason: string) => {
      if (!this.isActiveRoom(roomId)) return;
      this.playerEliminated$.next({ roomId, playerId, reason });
    });

    this.socket.on('actionAccepted', (actionId: string) => {
      this.actionAccepted$.next(actionId);
    });

    this.socket.on('error', (msg: string) => {
      this.error$.next(msg);
    });

    this.socket.on(
      'gameOver',
      (roomId: string, winner: string | null, soloWinner?: GameOverPayload['soloWinner']) => {
        if (!this.isActiveRoom(roomId)) return;
        this.gameOver$.next({ roomId, winner, soloWinner });
      },
    );
  }
}
