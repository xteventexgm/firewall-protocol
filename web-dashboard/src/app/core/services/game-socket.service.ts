import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GameOverPayload,
  GamePhase,
  IncidentDisplay,
  PhaseTransition,
  PublicGameState,
  ServerIncidentReport,
  SoloWinner,
  Team,
  VoteTiedPayload,
  VoteTrace,
} from '../models/game-state.model';
import {
  generateRoomCode,
  incidentsFromServerReport,
  sanitizeGameState,
} from '../utils/game.utils';

@Injectable({ providedIn: 'root' })
export class GameSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private listenersAttached = false;
  private gameEnded = false;

  readonly roomState$ = new BehaviorSubject<PublicGameState | null>(null);
  readonly phaseChanged$ = new Subject<{ roomId: string; phase: GamePhase }>();
  readonly phaseTransition$ = new Subject<PhaseTransition>();
  readonly gameOver$ = new Subject<GameOverPayload>();
  readonly voteTied$ = new Subject<VoteTiedPayload>();
  readonly voteTrace$ = new Subject<VoteTrace>();
  readonly error$ = new Subject<string>();
  readonly incidents$ = new Subject<{ incidents: IncidentDisplay[]; nightNumber: number }>();
  readonly connected$ = new BehaviorSubject<boolean>(false);

  get currentRoomId(): string | null {
    return this.roomId;
  }

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
      if (this.roomId) {
        this.socket?.emit('joinDashboard', this.roomId);
      }
    });
    this.socket.on('disconnect', () => this.connected$.next(false));
    this.socket.on('connect_error', (err: Error) => {
      this.connected$.next(false);
      this.error$.next(`No se pudo conectar al servidor: ${err.message}`);
    });

    this.attachListeners();
  }

  createLobby(maxPlayers: number): string {
    this.connect();
    const code = generateRoomCode();
    this.roomId = code;
    this.gameEnded = false;
    this.roomState$.next(null);

    this.socket?.emit('createRoom', code, maxPlayers);
    this.socket?.emit('joinDashboard', code);
    return code;
  }

  joinRoom(roomId: string): void {
    this.connect();
    const code = roomId.toUpperCase().trim();
    this.roomId = code;
    this.gameEnded = false;
    this.roomState$.next(null);
    this.socket?.emit('joinDashboard', code);
  }

  softLeave(): void {
    if (this.roomId) {
      this.socket?.emit('leaveDashboard', this.roomId);
    }
    this.roomId = null;
    this.gameEnded = false;
    this.roomState$.next(null);
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

  get isGameEnded(): boolean {
    return this.gameEnded || this.roomState$.value?.phase === 'FIN';
  }

  getRealPlayerCount(state: PublicGameState | null): number {
    return state?.playerCount ?? state?.players.length ?? 0;
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
    if (host.includes('ngrok')) {
      headers['ngrok-skip-browser-warning'] = '69420';
    }
    if (host.includes('loca.lt') || host.includes('localtunnel')) {
      headers['Bypass-Tunnel-Reminder'] = 'true';
    }
    return headers;
  }

  private attachListeners(): void {
    if (!this.socket || this.listenersAttached) return;
    this.listenersAttached = true;

    this.socket.on('publicState', (state: unknown) => {
      const sanitized = sanitizeGameState(state);
      if (!this.matchesRoom(sanitized.roomId)) return;
      if (sanitized.phase === 'FIN') {
        this.gameEnded = true;
      }
      this.roomState$.next(sanitized);
    });

    this.socket.on('phaseChanged', (rid: string, phase: GamePhase) => {
      if (!this.matchesRoom(rid)) return;
      this.patchRoomState({ phase });
      this.phaseChanged$.next({ roomId: rid.toUpperCase(), phase });
    });

    this.socket.on('phaseTransition', (transition: PhaseTransition) => {
      if (!this.matchesRoom(transition.roomId)) return;
      if (this.gameEnded || this.roomState$.value?.phase === 'FIN') return;
      this.phaseTransition$.next(transition);
    });

    this.socket.on('incidentReport', (report: ServerIncidentReport) => {
      if (!this.matchesRoom(report.roomId)) return;
      if (this.gameEnded || this.roomState$.value?.phase === 'FIN') return;
      const incidents = incidentsFromServerReport(report.disconnected, this.roomState$.value);
      if (incidents.length) {
        this.incidents$.next({ incidents, nightNumber: report.nightNumber });
      }
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

    this.socket.on('error', (msg: string) => this.error$.next(msg));
  }

  private matchesRoom(roomId: string | undefined | null): boolean {
    if (!roomId) return false;
    if (!this.roomId) return true;
    return roomId.toUpperCase() === this.roomId.toUpperCase();
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
}
