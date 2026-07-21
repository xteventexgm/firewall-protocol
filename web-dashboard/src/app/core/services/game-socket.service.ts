import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GameOverPayload,
  GamePhase,
  IncidentDisplay,
  NightResolution,
  PhaseTransition,
  PublicGameState,
  RoomCreatedPayload,
  SocketIncidentReport,
  SoloWinner,
  Team,
  VoteTiedPayload,
  VoteTrace,
  ChatMessage,
  GameStatsEntry,
  NightProgress,
  PhaseConfig,
  PublicLogEntry,
} from '../models/game-state.model';
import {
  generateRoomCode,
  incidentsFromServerReport,
  sanitizeGameState,
} from '../utils/game.utils';
import { socketReconnectOptions } from '../utils/socket-reconnect.utils';
import {
  formatServerErrorForToast,
  inferJoinErrorCode,
  isFatalJoinError,
  isJoinPendingError,
  parseServerErrorMessage,
} from '../utils/error.utils';

@Injectable({ providedIn: 'root' })
export class GameSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private listenersAttached = false;
  private gameEnded = false;
  private pendingCreateCode: string | null = null;
  private joinPending = false;

  readonly roomState$ = new BehaviorSubject<PublicGameState | null>(null);
  readonly phaseTransition$ = new Subject<PhaseTransition>();
  readonly gameOver$ = new Subject<GameOverPayload>();
  readonly voteTied$ = new Subject<VoteTiedPayload>();
  readonly voteTrace$ = new Subject<VoteTrace>();
  readonly nightResolved$ = new Subject<{ roomId: string; resolution: NightResolution }>();
  readonly playerEliminated$ = new Subject<{ roomId: string; playerId: string; reason: string; role?: string }>();
  readonly playerDisconnected$ = new Subject<{ roomId: string; playerId: string; playerName?: string }>();
  readonly playerReconnected$ = new Subject<{ roomId: string; playerId: string; playerName?: string }>();
  readonly playerConnected$ = new Subject<{ roomId: string; playerId: string; playerName?: string }>();
  readonly info$ = new Subject<string>();
  readonly error$ = new Subject<string>();
  readonly incidents$ = new Subject<{ incidents: IncidentDisplay[]; nightNumber: number }>();
  readonly connected$ = new BehaviorSubject<boolean>(false);
  readonly reconnecting$ = new BehaviorSubject<boolean>(false);
  readonly publicLog$ = new Subject<PublicLogEntry>();
  readonly chatMessage$ = new Subject<ChatMessage>();
  readonly nightProgress$ = new Subject<NightProgress>();
  readonly gameStats$ = new Subject<GameStatsEntry[]>();
  /** Emite cuando un joinDashboard pendiente termina (éxito o fallo). */
  readonly joinOutcome$ = new Subject<{ ok: boolean; error?: string }>();

  get currentRoomId(): string | null {
    return this.roomId;
  }

  private reconnectWatchdog?: ReturnType<typeof setInterval>;

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
    };

    const extraHeaders = this.buildTunnelHeaders();
    if (Object.keys(extraHeaders).length > 0) {
      socketOptions.extraHeaders = extraHeaders;
      socketOptions.transportOptions = {
        polling: { extraHeaders },
      };
    }

    this.socket = io(url, socketOptions);

    let warmingUpToastShown = false;

    this.socket.on('connect', () => {
      warmingUpToastShown = false;
      this.connected$.next(true);
      this.reconnecting$.next(false);
      if (this.roomId) {
        this.socket?.emit('joinDashboard', this.roomId);
      }
    });
    this.socket.on('disconnect', () => {
      this.connected$.next(false);
      if (this.roomId) this.reconnecting$.next(true);
    });
    this.socket.on('connect_error', (err: Error) => {
      this.connected$.next(false);
      if (!warmingUpToastShown) {
        warmingUpToastShown = true;
        this.info$.next('Despertando los servidores de juego en la nube... (Esto puede tomar hasta 50 segundos la primera vez)');
      }
      if (this.roomId) this.reconnecting$.next(true);
      // Omitimos emitir el error$ aquí para no spamear al usuario durante el calentamiento.
    });

    this.socket.io.on('reconnect_attempt', () => {
      if (!warmingUpToastShown) {
        warmingUpToastShown = true;
        this.info$.next('Despertando los servidores de juego en la nube... (Esto puede tomar hasta 50 segundos la primera vez)');
      }
      if (this.roomId) this.reconnecting$.next(true);
    });

    this.socket.io.on('reconnect_failed', () => {
      this.socket?.connect();
    });

    this.attachListeners();
    this.startReconnectWatchdog();
  }

  ensureConnection(): void {
    if (!this.roomId) return;
    if (!this.socket) {
      this.connect();
      return;
    }
    if (!this.socket.connected) {
      this.reconnecting$.next(true);
      this.socket.connect();
    }
  }

  private startReconnectWatchdog(): void {
    if (this.reconnectWatchdog) return;
    this.reconnectWatchdog = setInterval(() => {
      if (!this.roomId) return;
      if (this.socket?.connected) {
        if (this.reconnecting$.value) this.reconnecting$.next(false);
        return;
      }
      this.ensureConnection();
    }, 5_000);
  }

  createLobby(maxPlayers: number): string {
    this.connect();
    const code = generateRoomCode();
    this.roomId = code;
    this.pendingCreateCode = code;
    this.gameEnded = false;
    this.roomState$.next(null);

    this.socket?.emit('createRoom', code, maxPlayers);
    setTimeout(() => {
      if (this.pendingCreateCode === code && this.roomId === code) {
        this.pendingCreateCode = null;
        this.socket?.emit('joinDashboard', code);
      }
    }, 800);
    return code;
  }

  joinRoom(roomId: string): void {
    this.connect();
    const code = roomId.toUpperCase().trim();
    this.roomId = code;
    this.gameEnded = false;
    this.joinPending = true;
    this.reconnecting$.next(true);
    this.ensureConnection();
    this.roomState$.next(null);
    this.socket?.emit('joinDashboard', code);
  }

  softLeave(): void {
    if (this.roomId) {
      this.socket?.emit('leaveDashboard', this.roomId);
    }
    this.roomId = null;
    this.gameEnded = false;
    this.joinPending = false;
    this.roomState$.next(null);
  }

  abandonLobby(roomId?: string): void {
    const code = (roomId ?? this.roomId)?.toUpperCase().trim();
    if (code) {
      this.socket?.emit('abandonLobby', code);
    }
    if (!roomId || code === this.roomId) {
      this.softLeave();
    }
  }

  leaveLobby(): void {
    this.softLeave();
  }

  startGame(): void {
    if (!this.roomId || this.gameEnded) return;
    this.socket?.emit('startGame', this.roomId);
  }

  advancePhase(): void {
    if (!this.roomId || this.gameEnded) return;
    const phase = this.roomState$.value?.phase;
    if (phase === 'FIN') return;
    this.socket?.emit('advancePhase', this.roomId);
  }

  /** Añade un bot de QA (un clic = un bot). Solo en LOBBY con jugador real. */
  fillBots(): void {
    if (!this.roomId || this.gameEnded) return;
    this.socket?.emit('fillBots', this.roomId);
  }

  /** Expulsa un nodo de la sala (solo LOBBY). */
  kickPlayer(playerId: string): void {
    if (!this.roomId || this.gameEnded) return;
    this.socket?.emit('kickPlayer', this.roomId, playerId);
  }

  /** Quita todos los bots de QA de la sala. Solo en LOBBY. */
  clearBots(): void {
    if (!this.roomId || this.gameEnded) return;
    this.socket?.emit('clearBots', this.roomId);
  }

  /** Partida QA: bots + auto-avance rápido hasta FIN. Solo en LOBBY. */
  runBotQaMatch(): void {
    if (!this.roomId || this.gameEnded) return;
    this.socket?.emit('runBotQaMatch', this.roomId);
  }

  setPhaseConfig(config: Partial<PhaseConfig>): void {
    if (!this.roomId) return;
    this.socket?.emit('setPhaseConfig', this.roomId, config);
  }

  get isGameEnded(): boolean {
    return this.gameEnded || this.roomState$.value?.phase === 'FIN';
  }

  ngOnDestroy(): void {
    this.leaveLobby();
    this.socket?.disconnect();
    this.socket = null;
    this.listenersAttached = false;
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
    if (host.includes('ngrok') || host.includes('zrok')) {
      headers['ngrok-skip-browser-warning'] = '69420';
    }
    if (host.includes('loca.lt') || host.includes('localtunnel') || host.includes('zrok')) {
      headers['Bypass-Tunnel-Reminder'] = 'true';
    }
    if (host.includes('zrok')) {
      headers['skip_zrok_interstitial'] = 'true';
    }
    return headers;
  }

  private attachListeners(): void {
    if (!this.socket || this.listenersAttached) return;
    this.listenersAttached = true;

    this.socket.on('roomCreated', (payload: RoomCreatedPayload) => {
      const code = payload.roomId.toUpperCase();
      if (this.pendingCreateCode === code || this.roomId === code) {
        this.pendingCreateCode = null;
        this.roomId = code;
        this.socket?.emit('joinDashboard', code);
      }
    });

    this.socket.on('publicState', (state: unknown) => {
      const sanitized = sanitizeGameState(state);
      if (!this.matchesRoom(sanitized.roomId)) return;
      if (sanitized.phase === 'FIN') {
        this.gameEnded = true;
      }
      this.reconnecting$.next(false);
      this.roomState$.next(sanitized);
      if (this.joinPending) {
        this.joinPending = false;
        this.joinOutcome$.next({ ok: true });
      }
    });

    this.socket.on('phaseChanged', (rid: string, phase: GamePhase) => {
      if (!this.matchesRoom(rid)) return;
      this.patchRoomState({ phase });
    });

    this.socket.on('phaseTransition', (transition: PhaseTransition) => {
      if (!this.matchesRoom(transition.roomId)) return;
      if (this.gameEnded || this.roomState$.value?.phase === 'FIN') return;
      this.phaseTransition$.next(transition);
    });

    this.socket.on('incidentReport', (report: SocketIncidentReport) => {
      if (!this.matchesRoom(report.roomId)) return;
      if (this.gameEnded || this.roomState$.value?.phase === 'FIN') return;
      const incidents = incidentsFromServerReport(report, this.roomState$.value);
      if (incidents.length) {
        this.incidents$.next({ incidents, nightNumber: report.nightNumber });
      }
    });

    this.socket.on('nightResolved', (roomId: string, resolution: NightResolution) => {
      if (!this.matchesRoom(roomId)) return;
      if (this.gameEnded || this.roomState$.value?.phase === 'FIN') return;
      const full: NightResolution = {
        kills: resolution.kills ?? [],
        prevented: resolution.prevented ?? [],
        redirects: resolution.redirects ?? [],
        logs: [],
        privateResults: [],
        silenced: resolution.silenced ?? [],
        honeypotDrags: resolution.honeypotDrags ?? [],
        infections: resolution.infections ?? [],
        cures: resolution.cures ?? [],
        infectionKills: resolution.infectionKills ?? [],
      };
      this.nightResolved$.next({ roomId: roomId.toUpperCase(), resolution: full });
    });

    this.socket.on('playerEliminated', (roomId: string, playerId: string, reason: string, role?: string) => {
      if (!this.matchesRoom(roomId)) return;
      this.playerEliminated$.next({ roomId: roomId.toUpperCase(), playerId, reason, role });
    });

    this.socket.on('playerDisconnected', (roomId: string, playerId: string, playerName?: string) => {
      if (!this.matchesRoom(roomId)) return;
      this.playerDisconnected$.next({ roomId: roomId.toUpperCase(), playerId, playerName });
    });

    this.socket.on('playerReconnected', (roomId: string, playerId: string, playerName?: string) => {
      if (!this.matchesRoom(roomId)) return;
      this.playerReconnected$.next({ roomId: roomId.toUpperCase(), playerId, playerName });
    });

    this.socket.on('playerConnected', (roomId: string, playerId: string, playerName?: string) => {
      if (!this.matchesRoom(roomId)) return;
      this.playerConnected$.next({ roomId: roomId.toUpperCase(), playerId, playerName });
    });

    this.socket.on('voteTrace', (trace: VoteTrace) => {
      if (!this.matchesRoom(trace.roomId)) return;
      if (this.gameEnded || this.roomState$.value?.phase === 'FIN') return;
      this.voteTrace$.next(trace);
    });

    this.socket.on('voteTied', (payload: VoteTiedPayload) => {
      if (!this.matchesRoom(payload.roomId)) return;
      if (this.gameEnded || this.roomState$.value?.phase === 'FIN') return;
      this.voteTied$.next(payload);
    });

    this.socket.on(
      'gameOver',
      (roomId: string, winner: Team | null, soloWinner?: SoloWinner | null) => {
        if (!this.matchesRoom(roomId)) return;
        this.gameEnded = true;
        const payload: GameOverPayload = { roomId: roomId.toUpperCase(), winner, soloWinner };
        this.patchRoomState({
          phase: 'FIN',
          winner: winner ?? null,
          soloWinner: soloWinner ?? null,
        });
        this.gameOver$.next(payload);
      },
    );

    this.socket.on('error', (msg: string) => this.handleServerError(msg));

    this.socket.on('publicLog', (roomId: string, entry: PublicLogEntry) => {
      if (!this.matchesRoom(roomId)) return;
      this.publicLog$.next(entry);
      const current = this.roomState$.value;
      if (current) {
        const logs = [...(current.publicLogs ?? []), entry].slice(-50);
        this.patchRoomState({ publicLogs: logs });
      }
    });

    this.socket.on('chatMessage', (roomId: string, message: ChatMessage) => {
      if (!this.matchesRoom(roomId)) return;
      this.chatMessage$.next(message);
      const current = this.roomState$.value;
      if (current) {
        const msgs = [...(current.chatMessages ?? []), message].slice(-50);
        this.patchRoomState({ chatMessages: msgs });
      }
    });

    this.socket.on('nightProgress', (roomId: string, progress: NightProgress) => {
      if (!this.matchesRoom(roomId)) return;
      this.nightProgress$.next(progress);
      this.patchRoomState({ nightProgress: progress });
    });

    this.socket.on('gameStats', (roomId: string, stats: GameStatsEntry[]) => {
      if (!this.matchesRoom(roomId)) return;
      this.gameStats$.next(stats);
      this.patchRoomState({ gameStats: stats });
    });

    this.socket.on('phaseConfigChanged', (roomId: string, config: PhaseConfig) => {
      if (!this.matchesRoom(roomId)) return;
      this.patchRoomState({ phaseConfig: config });
    });
  }

  private patchRoomState(patch: Partial<PublicGameState>): void {
    const current = this.roomState$.value;
    if (!current) {
      if (!this.roomId) return;
      this.roomState$.next({
        roomId: this.roomId,
        phase: (patch.phase ?? 'LOBBY') as GamePhase,
        phaseStartedAt: Date.now(),
        players: patch.players ?? [],
        dayNumber: patch.dayNumber ?? 0,
        nightNumber: patch.nightNumber ?? 0,
        maxPlayers: patch.maxPlayers ?? 0,
        playerCount: patch.playerCount ?? 0,
        votes: patch.votes ?? {},
        winner: patch.winner ?? null,
        soloWinner: patch.soloWinner ?? null,
      });
      return;
    }
    this.roomState$.next({ ...current, ...patch });
  }

  private matchesRoom(roomId: string | undefined | null): boolean {
    if (!roomId) return false;
    if (!this.roomId) return true;
    return roomId.toUpperCase() === this.roomId.toUpperCase();
  }

  private handleServerError(msg: string): void {
    const { message, code } = parseServerErrorMessage(msg);
    const resolvedCode = code ?? inferJoinErrorCode(message);
    const toastMsg = formatServerErrorForToast(msg);

    if (this.joinPending && isJoinPendingError(resolvedCode, message)) {
      this.joinPending = false;
      this.roomId = null;
      this.reconnecting$.next(false);
      this.joinOutcome$.next({ ok: false, error: toastMsg });
    } else if (isFatalJoinError(resolvedCode, message)) {
      this.roomId = null;
      this.roomState$.next(null);
      this.reconnecting$.next(false);
    }

    this.error$.next(toastMsg);
  }
}
