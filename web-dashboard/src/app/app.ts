import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameSocketService } from './core/services/game-socket.service';
import { IncidentReport, PublicGameState } from './core/models/game-state.model';
import { LobbyComponent } from './features/lobby/lobby.component';
import { TopologyComponent } from './features/topology/topology.component';
import { PhaseOverlayComponent } from './features/phases/phase-overlay.component';
import { VoteLinesComponent } from './features/votes/vote-lines.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    LobbyComponent,
    TopologyComponent,
    PhaseOverlayComponent,
    VoteLinesComponent,
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
  incidents: IncidentReport[] = [];
  glitchPlayerIds: string[] = [];
  showIncidentReport = false;
  errorMessage = '';

  ngOnInit(): void {
    this.gameSocket.connect();

    this.subs.push(
      this.gameSocket.connected$.subscribe((c) => (this.connected = c)),
      this.gameSocket.roomState$.subscribe((s) => {
        this.state = s;
        if (s && !this.roomCode) this.roomCode = s.roomId;
      }),
      this.gameSocket.incidents$.subscribe((incidents) => {
        this.incidents = incidents;
        this.glitchPlayerIds = incidents.map((i) => i.playerId);
        this.showIncidentReport = incidents.length > 0;
        setTimeout(() => {
          this.showIncidentReport = false;
          this.glitchPlayerIds = [];
        }, 8000);
      }),
      this.gameSocket.error$.subscribe((msg) => {
        this.errorMessage = msg;
        setTimeout(() => (this.errorMessage = ''), 5000);
      }),
    );
  }

  onCreateLobby(): void {
    this.roomCode = this.gameSocket.createLobby();
    this.incidents = [];
    this.showIncidentReport = false;
  }

  onStartGame(): void {
    this.gameSocket.startGame();
  }

  onAdvancePhase(): void {
    this.gameSocket.advancePhase();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
