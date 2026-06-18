import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameSocketService } from './core/services/game-socket.service';
import {
  GameOverSummary,
  GamePhase,
  IncidentDisplay,
  PublicGameState,
} from './core/models/game-state.model';
import { buildGameOverSummary } from './core/utils/game.utils';
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

  roomCode = '';
  state: PublicGameState | null = null;
  connected = false;
  incidents: IncidentDisplay[] = [];
  glitchPlayerIds: string[] = [];
  showIncidentReport = false;
  incidentNightNumber = 0;
  errorMessage = '';
  voteTiedMessage = '';
  showGameOver = false;
  gameOverSummary: GameOverSummary | null = null;
  phaseFlash: GamePhase | '' = '';

  ngOnInit(): void {
    this.gameSocket.connect();

    this.subs.push(
      this.gameSocket.connected$.subscribe((c) => (this.connected = c)),
      this.gameSocket.roomState$.subscribe((s) => {
        this.state = s;
        if (s && !this.roomCode) this.roomCode = s.roomId;
        if (s?.phase === 'FIN' && (s.winner || s.soloWinner)) {
          this.refreshGameOverSummary();
        }
      }),
      this.gameSocket.incidents$.subscribe(({ incidents, nightNumber }) => {
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
        this.phaseFlash = transition.to;
        setTimeout(() => (this.phaseFlash = ''), 2000);
      }),
      this.gameSocket.gameOver$.subscribe(() => {
        this.showGameOver = true;
        this.refreshGameOverSummary();
      }),
      this.gameSocket.voteTied$.subscribe(({ voteCount, candidates }) => {
        this.voteTiedMessage = `Empate — ${candidates.length} candidatos con ${voteCount} votos`;
        setTimeout(() => (this.voteTiedMessage = ''), 5000);
      }),
      this.gameSocket.error$.subscribe((msg) => {
        this.errorMessage = msg;
        setTimeout(() => (this.errorMessage = ''), 5000);
      }),
    );
  }

  onCreateLobby(maxPlayers: number): void {
    this.roomCode = this.gameSocket.createLobby(maxPlayers);
    this.incidents = [];
    this.showIncidentReport = false;
    this.showGameOver = false;
    this.gameOverSummary = null;
  }

  onStartGame(): void {
    this.gameSocket.startGame();
  }

  onAdvancePhase(): void {
    this.gameSocket.advancePhase();
  }

  onExitRoom(): void {
    this.gameSocket.leaveLobby();
    this.roomCode = '';
    this.state = null;
    this.showGameOver = false;
    this.gameOverSummary = null;
    this.incidents = [];
    this.showIncidentReport = false;
    this.glitchPlayerIds = [];
    this.incidentNightNumber = 0;
    this.voteTiedMessage = '';
    this.phaseFlash = '';
  }

  private refreshGameOverSummary(): void {
    const summary = buildGameOverSummary(this.state);
    if (summary) {
      this.gameOverSummary = summary;
      this.showGameOver = true;
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
