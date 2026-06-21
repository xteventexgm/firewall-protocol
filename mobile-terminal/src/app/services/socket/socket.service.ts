import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getNightActionType } from '../../core/role-actions';
import {
  getEliminatedIdsFromIncident,
  sanitizeRoomState,
} from '../../core/utils/game.utils';
import {
  clearGameSessionStorage,
  formatServerErrorForToast,
  inferJoinErrorCode,
  isFatalJoinError,
  parseServerErrorMessage,
} from '../../core/utils/error.utils';
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
  MinigameChallenge,
  NightProgress,
  ChatMessage,
  PublicLogEntry,
  GameStatsEntry,
} from '../../core/models/game-state.model';

export type { GamePhase, RoomPlayer, TargetOption };

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly router = inject(Router);
  private socket: Socket | null = null;
  private listenersAttached = false;
  private gameOverNavTimer?: ReturnType<typeof setTimeout>;
  /** Solo re-join automático tras caída de socket, no en el primer connect. */
  private pendingAutoRejoin = false;
  private manualJoinInFlight = false;

  private myRole: string | undefined;
  private myTeam: string | undefined;

  readonly connected$ = new BehaviorSubject<boolean>(false);
  readonly reconnecting$ = new BehaviorSubject<boolean>(false);

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
  readonly playerReconnected$ = new Subject<{ roomId: string; playerId: string; playerName?: string }>();
  readonly playerConnected$ = new Subject<{ roomId: string; playerId: string; playerName?: string }>();
  readonly playerDisconnected$ = new Subject<{ roomId: string; playerId: string; playerName?: string }>();
  readonly playerEliminated$ = new Subject<{ roomId: string; playerId: string; reason: string }>();
  readonly lobbyClosed$ = new Subject<{ roomId: string; reason?: string }>();
  readonly gameOver$ = new Subject<GameOverPayload>();
  readonly minigameChallenge$ = new Subject<MinigameChallenge>();
  readonly minigameAnswerResult$ = new Subject<{
    result: 'success' | 'failed' | 'skipped' | 'expired';
    successHint?: string;
    failHint?: string;
  }>();
  readonly nightProgress$ = new Subject<NightProgress>();
  readonly chatMessage$ = new Subject<ChatMessage>();
  readonly publicLog$ = new Subject<PublicLogEntry>();
  readonly gameStats$ = new Subject<GameStatsEntry[]>();

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
      if (this.pendingAutoRejoin && !this.manualJoinInFlight) {
        this.autoRejoinFromStorage();
        this.pendingAutoRejoin = false;
      }
    });

    this.socket.on('disconnect', () => {
      this.connected$.next(false);
      if (localStorage.getItem('roomCode')) {
        this.reconnecting$.next(true);
        this.pendingAutoRejoin = true;
      }
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
    this.manualJoinInFlight = true;
    this.pendingAutoRejoin = false;
    this.connect();
    const code = roomId.toUpperCase().trim();

    localStorage.setItem('roomCode', code);
    localStorage.setItem('myPlayerId', playerId);
    localStorage.setItem('playerName', name);

    this.socket?.emit('joinRoom', code, playerId, name, { autoReconnect: false });
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

  submitChat(text: string, channel: 'public' | 'dead' | 'hacker' = 'public'): boolean {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    if (!roomId || !playerId || !this.socket?.connected) return false;
    this.socket.emit('submitChat', roomId, { playerId, text, channel });
    return true;
  }

  submitDayAction(type: string, target?: string): boolean {
    const roomId = localStorage.getItem('roomCode');
    const actor = localStorage.getItem('myPlayerId');
    if (!roomId || !actor || !this.socket?.connected) return false;
    this.socket.emit('submitDayAction', roomId, { actor, type, target });
    return true;
  }

  requestMinigame(): void {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    if (!roomId || !playerId) return;
    this.socket?.emit('requestMinigame', roomId, playerId);
  }

  submitMinigameAnswer(token: string, answer: string | number): boolean {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    if (!roomId || !playerId || !this.socket?.connected) return false;
    this.socket.emit('submitMinigameAnswer', roomId, { playerId, token, answer });
    return true;
  }

  skipMinigame(token: string): boolean {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    if (!roomId || !playerId || !this.socket?.connected) return false;
    this.socket.emit('skipMinigame', roomId, { playerId, token });
    return true;
  }

  getMyRole(): string | undefined {
    return this.myRole;
  }

  getMyTeam(): string | undefined {
    return this.myTeam;
  }

  clearSession(): void {
    this.cancelGameOverRedirect();
    this.pendingAutoRejoin = false;
    this.manualJoinInFlight = false;
    this.leaveRoom();
    localStorage.removeItem('roomCode');
    localStorage.removeItem('playerName');
    localStorage.removeItem('myPlayerId');
    this.myRole = undefined;
    this.myTeam = undefined;
  }

  /** Sala eliminada por el host: limpia sesión sin intentar leaveRoom (la sala ya no existe). */
  exitAfterLobbyClosed(roomId: string, reason = 'host_abandoned'): void {
    const code = roomId.toUpperCase().trim();
    const storedRoom = localStorage.getItem('roomCode')?.toUpperCase();
    if (storedRoom && storedRoom !== code) return;

    this.reconnecting$.next(false);
    this.cancelGameOverRedirect();
    this.pendingAutoRejoin = false;
    this.manualJoinInFlight = false;
    clearGameSessionStorage();
    this.myRole = undefined;
    this.myTeam = undefined;
    this.lobbyClosed$.next({ roomId: code, reason });
  }

  /** Tras game over: invalida sesión y programa vuelta a login. */
  finalizeAfterGameOver(): void {
    this.cancelGameOverRedirect();
    this.leaveRoom();
    clearGameSessionStorage();
    this.myRole = undefined;
    this.myTeam = undefined;
  }

  /** Limpia sesión y redirige a login tras mostrar el overlay de victoria. */
  scheduleLoginRedirectAfterGameOver(delayMs = 5000): void {
    this.cancelGameOverRedirect();
    this.gameOverNavTimer = setTimeout(() => {
      clearGameSessionStorage();
      void this.router.navigate(['/login'], { queryParams: { finished: '1' } });
      this.gameOverNavTimer = undefined;
    }, delayMs);
  }

  cancelGameOverRedirect(): void {
    if (this.gameOverNavTimer) {
      clearTimeout(this.gameOverNavTimer);
      this.gameOverNavTimer = undefined;
    }
  }

  /** Re-emite joinRoom tras reconexión Socket.IO si hay sesión guardada. */
  private autoRejoinFromStorage(): void {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    const name = localStorage.getItem('playerName');
    if (!roomId || !playerId || !name) return;
    this.reconnecting$.next(true);
    this.socket?.emit('joinRoom', roomId.toUpperCase().trim(), playerId, name, { autoReconnect: true });
  }

  private handleServerError(msg: string): void {
    const { message, code } = parseServerErrorMessage(msg);
    const resolvedCode = code ?? inferJoinErrorCode(message);
    if (isFatalJoinError(resolvedCode, message)) {
      const roomId = localStorage.getItem('roomCode');
      if (resolvedCode === 'room_not_found' && roomId && this.router.url.includes('/dashboard')) {
        this.exitAfterLobbyClosed(roomId, 'room_not_found');
        return;
      }
      clearGameSessionStorage();
      this.reconnecting$.next(false);
      if (!this.router.url.includes('/login')) {
        void this.router.navigate(['/login'], {
          queryParams: resolvedCode ? { error: resolvedCode } : undefined,
        });
      }
    }
    this.error$.next(formatServerErrorForToast(msg));
  }

  private onGameOverFromServer(
    roomId: string,
    winner: string | null,
    soloWinner?: GameOverPayload['soloWinner'],
  ): void {
    this.cancelGameOverRedirect();
    this.gameOver$.next({ roomId, winner, soloWinner });
  }

  private attachListeners(): void {
    if (!this.socket || this.listenersAttached) return;
    this.listenersAttached = true;

    this.socket.on('roomState', (roomId: string, state: any) => {
      const storedRoom = localStorage.getItem('roomCode');
      if (storedRoom && roomId !== storedRoom) return;

      this.manualJoinInFlight = false;
      this.reconnecting$.next(false);
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
            frozen: !!me.frozen,
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

    this.socket.on('playerReconnected', (roomId: string, playerId: string, playerName?: string) => {
      this.playerReconnected$.next({ roomId, playerId, playerName });
    });

    this.socket.on('playerConnected', (roomId: string, playerId: string, playerName?: string) => {
      this.playerConnected$.next({ roomId, playerId, playerName });
    });

    this.socket.on('lobbyClosed', (roomId: string, payload?: { reason?: string }) => {
      this.exitAfterLobbyClosed(roomId, payload?.reason);
    });

    this.socket.on('playerDisconnected', (roomId: string, playerId: string, playerName?: string) => {
      this.playerDisconnected$.next({ roomId, playerId, playerName });
    });

    this.socket.on('playerEliminated', (roomId: string, playerId: string, reason: string) => {
      this.playerEliminated$.next({ roomId, playerId, reason });
    });

    this.socket.on('actionAccepted', (actionId: string) => {
      this.actionAccepted$.next(actionId);
    });

    this.socket.on('minigameChallenge', (_roomId: string, challenge: MinigameChallenge) => {
      this.minigameChallenge$.next(challenge);
    });

    this.socket.on('minigameAnswerResult', (_roomId: string, payload: {
      result: 'success' | 'failed' | 'skipped' | 'expired';
      successHint?: string;
      failHint?: string;
    }) => {
      this.minigameAnswerResult$.next(payload);
    });

    this.socket.on('nightProgress', (_roomId: string, progress: NightProgress) => {
      this.nightProgress$.next(progress);
    });

    this.socket.on('chatMessage', (_roomId: string, message: ChatMessage) => {
      this.chatMessage$.next(message);
    });

    this.socket.on('publicLog', (_roomId: string, entry: PublicLogEntry) => {
      this.publicLog$.next(entry);
    });

    this.socket.on('gameStats', (_roomId: string, stats: GameStatsEntry[]) => {
      this.gameStats$.next(stats);
    });

    this.socket.on('error', (msg: string) => {
      this.handleServerError(msg);
    });

    this.socket.on(
      'gameOver',
      (roomId: string, winner: string | null, soloWinner?: GameOverPayload['soloWinner']) => {
        this.onGameOverFromServer(roomId, winner, soloWinner);
      },
    );
  }
}
