import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GamePhase,
  IncidentReport,
  PublicGameState,
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

    this.socket.on('publicState', (state: unknown) => {
      const sanitized = sanitizeGameState(state);
      if (this.roomId && sanitized.roomId !== this.roomId) return;
      this.roomState$.next(sanitized);
    });

    this.socket.on('phaseChanged', (rid: string, phase: GamePhase) => {
      if (this.roomId && rid !== this.roomId) return;
      this.phaseChanged$.next({ roomId: rid, phase });
    });

    this.socket.on('incidentReport', (report: { roomId: string; disconnected: string[] }) => {
      if (this.roomId && report.roomId !== this.roomId) return;
      const incidents = incidentsFromServerReport(report.disconnected, this.roomState$.value);
      if (incidents.length) this.incidents$.next(incidents);
    });

    this.socket.on('voteTrace', () => {
      // publicState se actualiza vía roomBridge tras cada voto
    });

    this.socket.on('error', (msg: string) => this.error$.next(msg));
  }

  createLobby(): string {
    this.connect();
    const code = generateRoomCode();
    this.roomId = code;
    this.roomState$.next(null);

    this.socket?.emit('createRoom', code);
    this.socket?.emit('joinDashboard', code);
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

  ngOnDestroy(): void {
    if (this.roomId) {
      this.socket?.emit('leaveDashboard', this.roomId);
    }
    this.socket?.disconnect();
    this.socket = null;
  }
}
