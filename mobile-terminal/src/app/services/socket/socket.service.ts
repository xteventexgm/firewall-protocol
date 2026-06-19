import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getNightActionType } from '../../core/role-actions';
import {
  getEliminatedIdsFromIncident,
  sanitizeRoomState,
} from '../../core/utils/game.utils';
import {
  GamePhase,
  GameOverPayload,
  PhaseTransition,
  PlayerRoomState,
  PlayerView,
  PrivateResultPayload,
  PublicNightResolution,
  RoomPlayer,
  SocketIncidentReport,
  TargetOption,
  VoteTiedPayload,
  VoteTrace,
} from '../../core/models/game-state.model';

export type { GamePhase, RoomPlayer, TargetOption };

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private listenersAttached = false;

  private myRole: string | undefined;
  private myTeam: string | undefined;

  readonly connected$ = new BehaviorSubject<boolean>(false);

  readonly gameState$ = new Subject<PlayerRoomState & { roomId: string }>();
  readonly playerState$ = new Subject<PlayerView>();
  readonly privateResult$ = new Subject<PrivateResultPayload>();
  readonly error$ = new Subject<string>();
  readonly actionAccepted$ = new Subject<string>();
  readonly phaseChanged$ = new Subject<{ roomId: string; phase: GamePhase }>();
  readonly phaseTransition$ = new Subject<PhaseTransition>();
  readonly incidentReport$ = new Subject<SocketIncidentReport>();
  readonly nightResolved$ = new Subject<{ roomId: string; resolution: PublicNightResolution }>();
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

    const url = this.buildSocketUrl();
    const socketOptions: Parameters<typeof io>[1] = {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 15000,
    };

    const extraHeaders = this.buildTunnelHeaders();
    if (Object.keys(extraHeaders).length > 0) {
      socketOptions.extraHeaders = extraHeaders;
      socketOptions.transportOptions = {
        polling: { extraHeaders },
      };
    }

    this.socket = io(url, socketOptions);

    this.socket.on('connect', () => {
      this.connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      this.connected$.next(false);
    });

    this.socket.on('connect_error', (err: Error) => {
      this.connected$.next(false);
      this.error$.next(`No se pudo conectar al backend: ${err.message}`);
    });

    this.attachListeners();
  }

  private buildSocketUrl(): string {
    let base = environment.apiUrl.replace(/\/$/, '');
    if (!/^https?:\/\//i.test(base)) {
      base = `https://${base}`;
    }
    return `${base}${environment.socketNamespace}`;
  }

  private buildTunnelHeaders(): Record<string, string> {
    const host = environment.apiUrl.toLowerCase();
    const headers: Record<string, string> = {};
    if (host.includes('ngrok')) {
      headers['ngrok-skip-browser-warning'] = '69420';
    }
    if (host.includes('loca.lt') || host.includes('localtunnel')) {
      headers['Bypass-Tunnel-Reminder'] = 'true';
    }
    return headers;
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

  submitNightAction(targetId: string, meta?: Record<string, unknown>, actionType?: string): boolean {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    if (!roomId || !playerId || !this.socket?.connected) return false;

    const type = actionType ?? getNightActionType(this.myRole);
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
    localStorage.removeItem('myPlayerId');
    this.myRole = undefined;
    this.myTeam = undefined;
  }

  /** Tras game over: invalida sesión de sala para que RoomGuard no re-entre. */
  finalizeAfterGameOver(): void {
    this.leaveRoom();
    localStorage.removeItem('roomCode');
    localStorage.removeItem('myPlayerId');
    this.myRole = undefined;
    this.myTeam = undefined;
  }

  private attachListeners(): void {
    if (!this.socket || this.listenersAttached) return;
    this.listenersAttached = true;

    this.socket.on('roomState', (roomId: string, state: any) => {
      const storedRoom = localStorage.getItem('roomCode');
      if (storedRoom && roomId !== storedRoom) return;

      const sanitized = sanitizeRoomState({ ...state, roomId });
      this.gameState$.next(sanitized);

      const myPlayerId = localStorage.getItem('myPlayerId');
      if (myPlayerId && sanitized.players) {
        const me = sanitized.players.find((p) => p.id === myPlayerId);
        if (me) {
          this.playerState$.next({
            name: me.name,
            role: this.myRole ?? me.role ?? 'ESPERANDO ASIGNACIÓN',
            team: this.myTeam ?? me.team,
            isDead: !me.isAlive,
            silenced: !!me.silenced,
            isConnected: me.isConnected,
          });
        }
      }
    });

    this.socket.on('privateResult', (_roomId: string, payload: PrivateResultPayload) => {
      this.privateResult$.next(payload);

      if (payload.type === 'role_assigned') {
        this.myRole = payload.role;
        this.myTeam = payload.team;
        const name = localStorage.getItem('playerName') ?? '';
        this.playerState$.next({
          name,
          role: payload.displayName ?? payload.role ?? 'Desconocido',
          roleId: payload.role,
          team: payload.team,
          teamLabel: payload.teamLabel,
          roleDescription: payload.description,
          nightActionHint: payload.nightActionHint,
          isDead: false,
        });
      }
    });

    this.socket.on('phaseChanged', (roomId: string, phase: GamePhase) => {
      this.phaseChanged$.next({ roomId, phase });
    });

    this.socket.on('phaseTransition', (transition: PhaseTransition) => {
      this.phaseTransition$.next(transition);
    });

    this.socket.on('incidentReport', (report: SocketIncidentReport) => {
      this.incidentReport$.next({
        ...report,
        eliminatedPlayerIds: getEliminatedIdsFromIncident(report),
      });
    });

    this.socket.on('nightResolved', (roomId: string, resolution: PublicNightResolution) => {
      this.nightResolved$.next({ roomId, resolution });
    });

    this.socket.on('voteTrace', (trace: VoteTrace) => {
      this.voteTrace$.next(trace);
    });

    this.socket.on('voteTied', (payload: VoteTiedPayload) => {
      this.voteTied$.next(payload);
    });

    this.socket.on('playerReconnected', (roomId: string, playerId: string) => {
      this.playerReconnected$.next({ roomId, playerId });
    });

    this.socket.on('playerDisconnected', (roomId: string, playerId: string) => {
      this.playerDisconnected$.next({ roomId, playerId });
    });

    this.socket.on('playerEliminated', (roomId: string, playerId: string, reason: string) => {
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
        this.gameOver$.next({ roomId, winner, soloWinner });
      },
    );
  }
}
