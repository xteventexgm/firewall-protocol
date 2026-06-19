import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameSocketService } from './core/services/game-socket.service';
import {
  GameOverSummary,
  GamePhase,
  IncidentDisplay,
  NightResolution,
  PublicGameState,
  SavedRoom,
  VoteTrace,
} from './core/models/game-state.model';
import {
  buildGameOverSummary,
  buildGameOverSummaryFromPayload,
  formatNightResolutionToast,
  formatVoteTiedMessage,
  playerNameById,
  translateEliminationReason,
} from './core/utils/game.utils';
import { hasNightResolutionContent } from './core/utils/night-resolution.utils';
import { loadSavedRooms, removeRoom, saveRoom } from './core/utils/room-storage.utils';
import { LobbyComponent } from './features/lobby/lobby.component';
import { TopologyComponent } from './features/topology/topology.component';
import { PhaseOverlayComponent } from './features/phases/phase-overlay.component';
import { VoteLinesComponent } from './features/votes/vote-lines.component';
import { GameOverOverlayComponent } from './features/game-over/game-over-overlay.component';
import { NightResolutionPanelComponent } from './features/night-resolution/night-resolution-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    LobbyComponent,
    TopologyComponent,
    PhaseOverlayComponent,
    VoteLinesComponent,
    GameOverOverlayComponent,
    NightResolutionPanelComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly gameSocket = inject(GameSocketService);
  private subs: Subscription[] = [];
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;
  private nightPanelTimeout: ReturnType<typeof setTimeout> | null = null;

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
  statusMessageType: 'info' | 'warn' | 'success' | 'error' = 'warn';
  showGameOver = false;
  gameOverSummary: GameOverSummary | null = null;
  phaseFlash: GamePhase | '' = '';
  highlightTrace: VoteTrace | null = null;
  nightResolution: NightResolution | null = null;
  showNightResolution = false;
  lastVoteTiedSkipVotes = 0;
  phaseElapsed = '';

  private phaseTimerInterval: ReturnType<typeof setInterval> | null = null;

  get gameOverActive(): boolean {
    return this.showGameOver || this.state?.phase === 'FIN' || this.gameSocket.isGameEnded;
  }

  ngOnInit(): void {
    this.savedRooms = loadSavedRooms();
    this.gameSocket.connect();
    this.startPhaseTimer();

    this.subs.push(
      this.gameSocket.connected$.subscribe((c) => (this.connected = c)),
      this.gameSocket.roomState$.subscribe((s) => {
        this.state = s;
        if (s && this.inRoom && !this.roomCode) this.roomCode = s.roomId;
        if (s?.phase === 'VOTACION') {
          this.lastVoteTiedSkipVotes = 0;
        }
        if (s?.phase === 'FIN') {
          this.refreshGameOverSummary();
        }
      }),
      this.gameSocket.incidents$.subscribe(({ incidents, nightNumber }) => {
        if (!this.inRoom || this.gameOverActive) return;
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
      this.gameSocket.gameOver$.subscribe((payload) => {
        if (!this.inRoom) return;
        this.gameOverSummary = buildGameOverSummaryFromPayload(payload, this.state);
        this.showGameOver = true;
        if (this.state && this.state.phase !== 'FIN') {
          this.state = {
            ...this.state,
            phase: 'FIN',
            winner: payload.winner,
            soloWinner: payload.soloWinner ?? null,
          };
        }
      }),
      this.gameSocket.phaseTransition$.subscribe((transition) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.phaseFlash = transition.to;
        if (transition.to === 'VOTACION') {
          this.voteTiedMessage = '';
        }
        setTimeout(() => (this.phaseFlash = ''), 2000);
      }),
      this.gameSocket.voteTied$.subscribe((payload) => {
        if (!this.inRoom || this.gameOverActive) return;
        const candidateNames = payload.candidates.map((id) =>
          playerNameById(this.state, id),
        );
        this.lastVoteTiedSkipVotes = payload.skipVotes ?? 0;
        this.voteTiedMessage = formatVoteTiedMessage({
          reason: payload.reason,
          candidates: candidateNames,
          skipVotes: payload.skipVotes ?? 0,
        });
        this.showStatusMessage(this.voteTiedMessage, 'warn');
      }),
      this.gameSocket.nightResolved$.subscribe(({ resolution }) => {
        if (!this.inRoom || this.gameOverActive) return;
        const toast = formatNightResolutionToast(resolution);
        if (toast) {
          this.showStatusMessage(toast, 'warn');
        }
        if (hasNightResolutionContent(resolution)) {
          this.nightResolution = resolution;
          this.showNightResolution = true;
          if (this.nightPanelTimeout) clearTimeout(this.nightPanelTimeout);
          this.nightPanelTimeout = setTimeout(() => {
            this.showNightResolution = false;
            this.nightPanelTimeout = null;
          }, 12000);
        }
      }),
      this.gameSocket.playerEliminated$.subscribe(({ playerId, reason }) => {
        if (!this.inRoom || this.gameOverActive) return;
        const name = playerNameById(this.state, playerId);
        const role = this.state?.players.find((p) => p.id === playerId)?.role;
        const rolePart = role ? ` — ${role}` : '';
        this.showStatusMessage(
          `Nodo eliminado: ${name}${rolePart} (${translateEliminationReason(reason)})`,
          'error',
        );
      }),
      this.gameSocket.playerDisconnected$.subscribe(({ playerId }) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.showStatusMessage(
          `Nodo desconectado: ${playerNameById(this.state, playerId)}`,
          'warn',
        );
      }),
      this.gameSocket.playerReconnected$.subscribe(({ playerId }) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.showStatusMessage(
          `Nodo reconectado: ${playerNameById(this.state, playerId)}`,
          'success',
        );
      }),
      this.gameSocket.voteTrace$.subscribe((trace) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.highlightTrace = trace;
        setTimeout(() => {
          if (this.highlightTrace === trace) {
            this.highlightTrace = null;
          }
        }, 1500);
      }),
      this.gameSocket.error$.subscribe((msg) => {
        this.errorMessage = msg;
        setTimeout(() => {
          if (this.errorMessage === msg) this.errorMessage = '';
        }, 6000);
      }),
    );
  }

  onCreateLobby(maxPlayers: number): void {
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
    this.nightResolution = null;
    this.showNightResolution = false;
    this.lastVoteTiedSkipVotes = 0;
    if (this.nightPanelTimeout) {
      clearTimeout(this.nightPanelTimeout);
      this.nightPanelTimeout = null;
    }
  }

  private refreshGameOverSummary(): void {
    const summary = buildGameOverSummary(this.state);
    if (summary) {
      this.gameOverSummary = summary;
      this.showGameOver = true;
      return;
    }
    if (this.state?.phase === 'FIN') {
      this.gameOverSummary = buildGameOverSummaryFromPayload(
        {
          roomId: this.state.roomId,
          winner: this.state.winner,
          soloWinner: this.state.soloWinner,
        },
        this.state,
      );
      this.showGameOver = true;
    }
  }

  private showStatusMessage(
    msg: string,
    type: 'info' | 'warn' | 'success' | 'error',
  ): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusMessage = msg;
    this.statusMessageType = type;
    this.statusTimeout = setTimeout(() => {
      if (this.statusMessage === msg) {
        this.statusMessage = '';
        this.statusTimeout = null;
      }
    }, 6000);
  }

  private startPhaseTimer(): void {
    this.phaseTimerInterval = setInterval(() => {
      const startedAt = this.state?.phaseStartedAt;
      if (!startedAt || !this.inRoom) {
        this.phaseElapsed = '';
        return;
      }
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      this.phaseElapsed = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    if (this.nightPanelTimeout) clearTimeout(this.nightPanelTimeout);
    if (this.phaseTimerInterval) clearInterval(this.phaseTimerInterval);
    this.subs.forEach((s) => s.unsubscribe());
  }
}
