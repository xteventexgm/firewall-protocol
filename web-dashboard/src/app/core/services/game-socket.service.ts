import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DASHBOARD_PLAYER_ID,
  GamePhase,
  IncidentReport,
  PublicGameState,
} from '../models/game-state.model';
import {
  detectIncidents,
  generateRoomCode,
  sanitizeGameState,
} from '../utils/game.utils';

@Injectable({ providedIn: 'root' })
export class GameSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private previousState: PublicGameState | null = null;

  readonly roomState$ = new BehaviorSubject<PublicGameState | null>(null);
  readonly phaseChanged$ = new Subject<{ roomId: string; phase: GamePhase }>();
  readonly error$ = new Subject<string>();
  readonly incidents$ = new Subject<IncidentReport[]>();
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

    this.socket.on('roomState', (rid: string, state: unknown) => {
      if (this.roomId && rid !== this.roomId) return;
      this.handleRoomState(state);
    });

    this.socket.on('phaseChanged', (rid: string, phase: GamePhase) => {
      if (this.roomId && rid !== this.roomId) return;
      this.phaseChanged$.next({ roomId: rid, phase });

      const current = this.roomState$.value;
      if (phase === 'DIA' && current) {
        const incidents = detectIncidents(this.previousState, current);
        if (incidents.length) this.incidents$.next(incidents);
      }
    });

    this.socket.on('error', (msg: string) => this.error$.next(msg));
  }

  createLobby(): string {
    this.connect();
    const code = generateRoomCode();
    this.roomId = code;
    this.previousState = null;
    this.roomState$.next(null);

    this.socket?.emit('createRoom', code);
    this.socket?.emit('joinRoom', code, DASHBOARD_PLAYER_ID, 'Centro de Mando');
    return code;
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
    return state?.players.length ?? 0;
  }

  private handleRoomState(raw: unknown): void {
    const sanitized = sanitizeGameState(raw);
    const prev = this.roomState$.value;

    if (sanitized.phase === 'DIA' && prev && prev.phase === 'NOCHE') {
      const incidents = detectIncidents(prev, sanitized);
      if (incidents.length) this.incidents$.next(incidents);
    }

    this.previousState = prev;
    this.roomState$.next(sanitized);
  }

  ngOnDestroy(): void {
    if (this.roomId) {
      this.socket?.emit('leaveRoom', this.roomId, DASHBOARD_PLAYER_ID);
    }
    this.socket?.disconnect();
    this.socket = null;
  }
}
