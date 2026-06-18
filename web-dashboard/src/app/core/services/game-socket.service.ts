import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GameOverPayload,
  IncidentEvent,
  PhaseTransition,
  PublicGameState,
  RoomCreatedPayload,
  ServerIncidentReport,
  VoteTiedPayload,
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

  readonly roomState$ = new BehaviorSubject<PublicGameState | null>(null);
  readonly phaseTransition$ = new Subject<PhaseTransition>();
  readonly gameOver$ = new Subject<GameOverPayload>();
  readonly voteTied$ = new Subject<VoteTiedPayload>();
  readonly roomCreated$ = new Subject<RoomCreatedPayload>();
  readonly error$ = new Subject<string>();
  readonly incidents$ = new Subject<IncidentEvent>();
  readonly connected$ = new BehaviorSubject<boolean>(false);

  get currentRoomId(): string | null {
    return this.roomId;
  }

  connect(): void {
    if (this.socket?.connected) return;

    const url = `${environment.apiUrl}${environment.socketNamespace}`;
    this.socket = io(url, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => this.connected$.next(true));
    this.socket.on('disconnect', () => this.connected$.next(false));

    this.socket.on('publicState', (state: unknown) => {
      const sanitized = sanitizeGameState(state);
      if (this.roomId && sanitized.roomId !== this.roomId) return;
      this.roomState$.next(sanitized);
    });

    this.socket.on('phaseTransition', (transition: PhaseTransition) => {
      if (this.roomId && transition.roomId !== this.roomId) return;
      this.phaseTransition$.next(transition);
    });

    this.socket.on('incidentReport', (report: ServerIncidentReport) => {
      if (this.roomId && report.roomId !== this.roomId) return;
      const incidents = incidentsFromServerReport(report, this.roomState$.value);
      if (incidents.length) {
        this.incidents$.next({ incidents, nightNumber: report.nightNumber });
      }
    });

    this.socket.on(
      'gameOver',
      (roomId: string, winner: GameOverPayload['winner'], soloWinner?: GameOverPayload['soloWinner']) => {
        if (this.roomId && roomId !== this.roomId) return;
        this.gameOver$.next({ roomId, winner, soloWinner });
      },
    );

    this.socket.on('voteTied', (payload: VoteTiedPayload) => {
      if (this.roomId && payload.roomId !== this.roomId) return;
      this.voteTied$.next(payload);
    });

    this.socket.on('roomCreated', (payload: RoomCreatedPayload) => {
      if (this.roomId && payload.roomId !== this.roomId) return;
      this.roomCreated$.next(payload);
    });

    this.socket.on('voteTrace', () => {
      // publicState se actualiza vía roomBridge tras cada voto
    });

    this.socket.on('error', (msg: string) => this.error$.next(msg));
  }

  createLobby(maxPlayers: number): string {
    this.connect();
    const code = generateRoomCode();
    this.roomId = code;
    this.roomState$.next(null);

    this.socket?.emit('createRoom', code, maxPlayers);
    this.socket?.emit('joinDashboard', code);
    return code;
  }

  joinExistingLobby(code: string): void {
    this.connect();
    this.roomId = code.trim().toUpperCase();
    this.roomState$.next(null);
    this.socket?.emit('joinDashboard', this.roomId);
  }

  startGame(): void {
    if (!this.roomId) return;
    this.socket?.emit('startGame', this.roomId);
  }

  advancePhase(): void {
    if (!this.roomId) return;
    this.socket?.emit('advancePhase', this.roomId);
  }

  getRealPlayerCount(state: PublicGameState | null): number {
    return state?.playerCount ?? state?.players.length ?? 0;
  }

  leaveLobby(): void {
    if (this.roomId) {
      this.socket?.emit('leaveDashboard', this.roomId);
    }
    this.roomId = null;
    this.roomState$.next(null);
  }

  ngOnDestroy(): void {
    if (this.roomId) {
      this.socket?.emit('leaveDashboard', this.roomId);
    }
    this.socket?.disconnect();
    this.socket = null;
  }
}
