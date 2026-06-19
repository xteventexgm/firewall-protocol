import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameSocketService } from './core/services/game-socket.service';
import {
  GameOverSummary,
  GamePhase,
  IncidentDisplay,
  PublicGameState,
  SavedRoom,
  VoteTrace,
} from './core/models/game-state.model';
import {
  buildGameOverSummary,
  buildGameOverSummaryFromPayload,
  detectPlayerStatusChanges,
} from './core/utils/game.utils';
import { loadSavedRooms, removeRoom, saveRoom } from './core/utils/room-storage.utils';
import { LobbyComponent } from './features/lobby/lobby.component';
import { TopologyComponent } from './features/topology/topology.component';
import { PhaseOverlayComponent } from './features/phases/phase-overlay.component';
import { VoteLinesComponent } from './features/votes/vote-lines.component';
import { GameOverOverlayComponent } from './features/game-over/game-over-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    LobbyComponent,
    TopologyComponent,
    PhaseOverlayComponent,
    VoteLinesComponent,
    GameOverOverlayComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly gameSocket = inject(GameSocketService);
  private subs: Subscription[] = [];
  private previousState: PublicGameState | null = null;
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;

  inRoom = false;
  roomCode = '';
  savedRooms: SavedRoom[] = [];
  state: PublicGameState | null = null;
  connected = false;
  incidents: IncidentDisplay[] = [];
  glitchPlayerIds: string[] = [];
  showIncidentReport = false;
  incidentNightNumber = 0;
  errorMessage = '';
  voteTiedMessage = '';
  statusMessage = '';
  statusMessageType: 'warn' | 'success' | 'error' = 'warn';
  showGameOver = false;
  gameOverSummary: GameOverSummary | null = null;
  phaseFlash: GamePhase | '' = '';
  highlightTrace: VoteTrace | null = null;

  get gameOverActive(): boolean {
    return this.showGameOver || this.state?.phase === 'FIN';
  }

  ngOnInit(): void {
    this.savedRooms = loadSavedRooms();
    this.gameSocket.connect();

    this.subs.push(
      this.gameSocket.connected$.subscribe((c) => (this.connected = c)),
      this.gameSocket.roomState$.subscribe((s) => {
        if (s && this.inRoom) {
          const statusChanges = detectPlayerStatusChanges(this.previousState, s);
          for (const msg of statusChanges) {
            if (msg.startsWith('Nodo desconectado')) {
              this.showStatusMessage(msg, 'warn');
            } else if (msg.startsWith('Nodo reconectado')) {
              this.showStatusMessage(msg, 'success');
            } else if (msg.startsWith('Nodo eliminado')) {
              this.showStatusMessage(msg, 'error');
            }
          }
        }
        this.previousState = s;
        this.state = s;
        if (s && this.inRoom && !this.roomCode) this.roomCode = s.roomId;
        if (s?.phase === 'FIN' && (s.winner || s.soloWinner)) {
          this.refreshGameOverSummary();
        }
      }),
      this.gameSocket.incidents$.subscribe(({ incidents, nightNumber }) => {
        if (!this.inRoom) return;
        this.incidents = incidents;
        this.incidentNightNumber = nightNumber;
        this.glitchPlayerIds = incidents.map((i) => i.playerId);
        this.showIncidentReport = incidents.length > 0;
        setTimeout(() => {
          this.showIncidentReport = false;
          this.glitchPlayerIds = [];
          this.incidentNightNumber = 0;
        }, 8000);
      }),
      this.gameSocket.phaseTransition$.subscribe((transition) => {
        if (!this.inRoom) return;
        this.phaseFlash = transition.to;
        setTimeout(() => (this.phaseFlash = ''), 2000);
      }),
      this.gameSocket.gameOver$.subscribe((payload) => {
        if (!this.inRoom) return;
        this.gameOverSummary = buildGameOverSummaryFromPayload(payload, this.state);
        this.showGameOver = true;
      }),
      this.gameSocket.voteTied$.subscribe(({ voteCount, candidates, reason }) => {
        if (!this.inRoom) return;
        if (reason === 'no_votes') {
          this.voteTiedMessage = 'Sin votos de eliminación — avanzando a noche';
        } else {
          this.voteTiedMessage = `Empate — ${candidates.length} candidatos con ${voteCount} votos`;
        }
        setTimeout(() => (this.voteTiedMessage = ''), 5000);
      }),
      this.gameSocket.voteTrace$.subscribe((trace) => {
        if (!this.inRoom) return;
        this.highlightTrace = trace;
        setTimeout(() => {
          if (this.highlightTrace === trace) {
            this.highlightTrace = null;
          }
        }, 1500);
      }),
      this.gameSocket.error$.subscribe((msg) => {
        this.errorMessage = msg;
        setTimeout(() => (this.errorMessage = ''), 5000);
      }),
    );
  }

  onCreateLobby(maxPlayers: number): void {
    this.previousState = null;
    const code = this.gameSocket.createLobby(maxPlayers);
    saveRoom({ roomId: code, maxPlayers, savedAt: Date.now() });
    this.savedRooms = loadSavedRooms();
    this.inRoom = true;
    this.roomCode = code;
    this.clearActiveView();
    this.showGameOver = false;
    this.gameOverSummary = null;
  }

  onRejoinRoom(roomId: string): void {
    this.previousState = null;
    this.gameSocket.joinRoom(roomId);
    this.inRoom = true;
    this.roomCode = roomId.toUpperCase().trim();
    this.clearActiveView();
    this.showGameOver = false;
    this.gameOverSummary = null;
  }

  onBackToLobby(): void {
    this.gameSocket.softLeave();
    this.inRoom = false;
    this.roomCode = '';
    this.previousState = null;
    this.state = null;
    this.showGameOver = false;
    this.gameOverSummary = null;
    this.clearActiveView();
  }

  onRemoveSavedRoom(roomId: string): void {
    removeRoom(roomId);
    this.savedRooms = loadSavedRooms();
  }

  onStartGame(): void {
    if (this.gameOverActive) return;
    this.gameSocket.startGame();
  }

  onAdvancePhase(): void {
    if (this.gameOverActive) return;
    this.gameSocket.advancePhase();
  }

  private clearActiveView(): void {
    this.incidents = [];
    this.showIncidentReport = false;
    this.glitchPlayerIds = [];
    this.incidentNightNumber = 0;
    this.voteTiedMessage = '';
    this.statusMessage = '';
    this.phaseFlash = '';
    this.highlightTrace = null;
  }

  private refreshGameOverSummary(): void {
    const summary = buildGameOverSummary(this.state);
    if (summary) {
      this.gameOverSummary = summary;
      this.showGameOver = true;
    }
  }

  private showStatusMessage(msg: string, type: 'warn' | 'success' | 'error'): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusMessage = msg;
    this.statusMessageType = type;
    this.statusTimeout = setTimeout(() => {
      this.statusMessage = '';
      this.statusTimeout = null;
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.subs.forEach((s) => s.unsubscribe());
  }
}
