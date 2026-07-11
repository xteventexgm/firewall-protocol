import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { resolveApiBase, apiTunnelHeaders } from '../../core/utils/api-base.utils';
import { socketReconnectOptions } from '../../core/utils/socket-reconnect.utils';
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
import { GameSoundService } from '../game-sound.service';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly sound = inject(GameSoundService);
  private socket: Socket | null = null;
  private listenersAttached = false;
  private gameOverNavTimer?: ReturnType<typeof setTimeout>;
  /** Solo re-join automático tras caída de socket, no en el primer connect. */
  private pendingAutoRejoin = false;
  private manualJoinInFlight = false;
  private warmingUpToast: HTMLIonToastElement | null = null;

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
  readonly playerKicked$ = new Subject<{ roomId: string; reason?: string }>();
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

  private reconnectWatchdog?: ReturnType<typeof setInterval>;
  private lastGameState: (PlayerRoomState & { roomId: string }) | null = null;

  connect(): void {
    if (this.socket?.connected) return;

    if (this.socket && !this.socket.connected) {
      this.socket.connect();
      this.startReconnectWatchdog();
      return;
    }

    const url = this.buildSocketUrl();
    const socketOptions: Parameters<typeof io>[1] = {
      ...socketReconnectOptions(),
      transports: ['polling', 'websocket'],
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
      this.dismissWarmingUpToast();
      this.connected$.next(true);
      this.reconnecting$.next(false);
      if (this.pendingAutoRejoin && !this.manualJoinInFlight) {
        this.autoRejoinFromStorage();
        this.pendingAutoRejoin = false;
        this.sound.play('ui_confirm');
      }
    });

    this.socket.on('disconnect', () => {
      this.connected$.next(false);
      if (localStorage.getItem('roomCode')) {
        this.reconnecting$.next(true);
        this.pendingAutoRejoin = true;
      }
    });

    this.socket.on('connect_error', () => {
      this.connected$.next(false);
      this.showWarmingUpToast();
      if (localStorage.getItem('roomCode')) {
        this.reconnecting$.next(true);
        this.pendingAutoRejoin = true;
      }
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.showWarmingUpToast();
      if (localStorage.getItem('roomCode')) {
        this.reconnecting$.next(true);
      }
    });

    this.socket.io.on('reconnect_failed', () => {
      this.socket?.connect();
    });

    this.attachListeners();
    this.startReconnectWatchdog();
  }

  /** Mantiene intentos de conexión si hay sesión guardada y el socket quedó inactivo. */
  ensureConnection(): void {
    if (localStorage.getItem('roomCode')) {
      this.pendingAutoRejoin = true;
      if (!this.socket) {
        this.connect();
        return;
      }
      if (!this.socket.connected) {
        this.reconnecting$.next(true);
        this.socket.connect();
      }
    }
  }

  private startReconnectWatchdog(): void {
    if (this.reconnectWatchdog) return;
    this.reconnectWatchdog = setInterval(() => {
      if (!localStorage.getItem('roomCode')) return;
      if (this.socket?.connected) {
        if (this.reconnecting$.value) this.reconnecting$.next(false);
        return;
      }
      this.ensureConnection();
    }, 5_000);
  }

  private async showWarmingUpToast(): Promise<void> {
    if (this.warmingUpToast) return;
    this.warmingUpToast = await this.toastCtrl.create({
      message: 'Despertando los servidores de juego en la nube... (Esto puede tomar hasta 50 segundos la primera vez)',
      duration: 50000,
      position: 'top',
      color: 'warning',
      icon: 'cloud-offline-outline'
    });
    await this.warmingUpToast.present();
  }

  private async dismissWarmingUpToast(): Promise<void> {
    if (this.warmingUpToast) {
      await this.warmingUpToast.dismiss();
      this.warmingUpToast = null;
    }
  }

  /** Fuerza nueva conexión (p. ej. tras cambiar URL del backend/ngrok). */
  reconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.listenersAttached = false;
    }
    this.connected$.next(false);
    this.connect();
  }

  private buildSocketUrl(): string {
    return `${resolveApiBase()}${environment.socketNamespace}`;
  }

  private buildTunnelHeaders(): Record<string, string> {
    return apiTunnelHeaders();
  }

  private joinOpts(autoReconnect: boolean): { autoReconnect: boolean; accessToken?: string; userId?: string } {
    const accessToken = localStorage.getItem('fp_accessToken');
    let userId: string | undefined;
    const userRaw = localStorage.getItem('fp_user');
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user?._id) userId = user._id;
      } catch (e) { }
    }

    return {
      autoReconnect,
      ...(accessToken ? { accessToken } : {}),
      ...(userId ? { userId } : {}),
    };
  }

  joinRoom(roomId: string, playerId: string, name: string): void {
    this.manualJoinInFlight = true;
    this.pendingAutoRejoin = false;
    this.connect();
    const code = roomId.toUpperCase().trim();

    localStorage.setItem('roomCode', code);
    localStorage.setItem('myPlayerId', playerId);
    localStorage.setItem('playerName', name);

    this.socket?.emit('joinRoom', code, playerId, name, this.joinOpts(false));
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

  setPlayerReady(playerId: string, isReady: boolean): void {
    const roomId = localStorage.getItem('roomCode');
    if (!this.socket?.connected || !roomId) return;
    this.socket.emit('setPlayerReady', roomId, { playerId, isReady });
  }

  submitChat(text: string, channel: 'public' | 'dead' | 'hacker' = 'public', type: 'normal'|'reaction'|'last_will' = 'normal', targetPlayerId?: string): boolean {
    if (!this.socket?.connected) return false;
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    if (!roomId || !playerId) return false;
    this.socket.emit('submitChat', roomId, { playerId, text, channel, type, targetPlayerId });
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
    this.lastGameState = null;
    this.leaveRoom();
    localStorage.removeItem('roomCode');
    localStorage.removeItem('playerName');
    localStorage.removeItem('myPlayerId');
    this.myRole = undefined;
    this.myTeam = undefined;
  }

  /** Expulsado del lobby por el host. */
  exitAfterPlayerKicked(roomId: string, reason = 'host_kick'): void {
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
    this.playerKicked$.next({ roomId: code, reason });
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
    this.socket?.emit('joinRoom', roomId.toUpperCase().trim(), playerId, name, this.joinOpts(true));
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

  private patchGameState(patch: Partial<PlayerRoomState>): void {
    if (!this.lastGameState) return;
    const storedRoom = localStorage.getItem('roomCode');
    if (storedRoom && this.lastGameState.roomId !== storedRoom) return;
    this.lastGameState = { ...this.lastGameState, ...patch };
    this.gameState$.next(this.lastGameState);
  }

  private patchPlayerField(
    playerId: string,
    patch: Partial<RoomPlayer>,
  ): void {
    if (!this.lastGameState?.players?.length) return;
    const players = this.lastGameState.players.map((p) =>
      p.id === playerId ? { ...p, ...patch } : p,
    );
    this.patchGameState({ players });
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
      this.lastGameState = sanitized;
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
      this.patchGameState({ phase });
      this.phaseChanged$.next({ roomId, phase });
    });

    this.socket.on('phaseTransition', (transition: PhaseTransition) => {
      this.patchGameState({
        phase: transition.to,
        ...(transition.at ? { phaseStartedAt: transition.at, phaseEndsAt: null } : {}),
      });
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
      this.patchPlayerField(playerId, { isConnected: true });
      this.playerReconnected$.next({ roomId, playerId, playerName });
    });

    this.socket.on('playerConnected', (roomId: string, playerId: string, playerName?: string) => {
      this.patchPlayerField(playerId, { isConnected: true });
      this.playerConnected$.next({ roomId, playerId, playerName });
    });

    this.socket.on('lobbyClosed', (roomId: string, payload?: { reason?: string }) => {
      this.exitAfterLobbyClosed(roomId, payload?.reason);
    });

    this.socket.on('playerKicked', (roomId: string, payload?: { playerId?: string; reason?: string }) => {
      this.exitAfterPlayerKicked(roomId, payload?.reason ?? 'host_kick');
    });

    this.socket.on('playerDisconnected', (roomId: string, playerId: string, playerName?: string) => {
      this.patchPlayerField(playerId, { isConnected: false });
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
      this.patchGameState({ nightProgress: progress });
      this.nightProgress$.next(progress);
    });

    this.socket.on('chatMessage', (_roomId: string, message: ChatMessage) => {
      if (this.lastGameState) {
        const chatMessages = [...(this.lastGameState.chatMessages ?? []), message].slice(-50);
        this.patchGameState({ chatMessages });
      }
      this.chatMessage$.next(message);
    });

    this.socket.on('publicLog', (_roomId: string, entry: PublicLogEntry) => {
      this.publicLog$.next(entry);
    });

    this.socket.on('gameStats', (_roomId: string, stats: GameStatsEntry[]) => {
      this.patchGameState({ gameStats: stats });
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
