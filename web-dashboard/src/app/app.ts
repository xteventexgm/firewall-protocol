import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription, catchError, of, take, timeout } from 'rxjs';
import { GameSocketService } from './core/services/game-socket.service';
import { GameSoundService } from './core/services/game-sound.service';
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
import { PublicNightLogsComponent } from './features/public-logs/public-night-logs.component';
import { ChatFeedComponent } from './features/chat/chat-feed.component';
import { NightProgressComponent } from './features/phases/night-progress.component';
import { ThreatBriefingComponent } from './features/phases/threat-briefing.component';
import { phaseBulletin } from './core/utils/phase-bulletin.utils';
import { formatServerErrorForToast } from './core/utils/error.utils';
import { downloadGameReplay } from './core/utils/replay.utils';
import { fetchRoomStatus, isRoomStatusUnavailable } from './core/utils/room-status.utils';

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
    PublicNightLogsComponent,
    ChatFeedComponent,
    NightProgressComponent,
    ThreatBriefingComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly gameSocket = inject(GameSocketService);
  private readonly gameSound = inject(GameSoundService);
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
  phaseCountdown = '';
  soundMuted = false;
  showThreatBriefing = false;
  phaseBulletinText = '';
  exportingReplay = false;

  private phaseTimerInterval: ReturnType<typeof setInterval> | null = null;
  private lastPhase: GamePhase | '' = '';
  private timerWarningFired = false;
  private readonly connectedNoticeAt = new Map<string, number>();

  get gameOverActive(): boolean {
    return this.showGameOver || this.state?.phase === 'FIN' || this.gameSocket.isGameEnded;
  }

  ngOnInit(): void {
    this.savedRooms = loadSavedRooms();
    void this.pruneFinishedSavedRooms();
    this.gameSocket.connect();
    this.startPhaseTimer();

    this.subs.push(
      this.gameSocket.connected$.subscribe((c) => (this.connected = c)),
      this.gameSocket.roomState$.subscribe((s) => {
        this.state = s;
        if (s && this.inRoom && !this.roomCode) this.roomCode = s.roomId;
        if (s?.phase && s.phase !== this.lastPhase) {
          this.onPhaseSound(s.phase);
          this.timerWarningFired = false;
          this.phaseBulletinText = phaseBulletin(s.phase);
          this.lastPhase = s.phase;
        }
        if (s?.sessionThreatBrief && s.dayNumber === 1 && s.phase === 'DIA' && !this.threatBriefingSeenForRoom(s.roomId)) {
          this.showThreatBriefing = true;
          this.gameSound.play('game_start');
        }
        if (s?.phase === 'VOTACION') {
          this.lastVoteTiedSkipVotes = 0;
        }
        if (s?.phase === 'FIN') {
          this.refreshGameOverSummary();
        }
      }),
      this.gameSocket.incidents$.subscribe(({ incidents, nightNumber }) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.gameSound.play('incident');
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
        this.gameSound.play(
          payload.soloWinner ? 'game_over_solo' : payload.winner === 'black_hat' ? 'game_over_hacker' : 'game_over_system',
        );
        this.gameOverSummary = buildGameOverSummaryFromPayload(payload, this.state);
        if (this.state?.gameStats) {
          this.gameOverSummary = { ...this.gameOverSummary, stats: this.state.gameStats };
        }
        this.showGameOver = true;
        if (this.roomCode) removeRoom(this.roomCode);
        this.savedRooms = loadSavedRooms();
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
        this.phaseBulletinText = phaseBulletin(transition.to);
        if (transition.to === 'NOCHE') this.gameSound.play('night');
        if (transition.to === 'DIA') this.gameSound.play('day');
        if (transition.to === 'VOTACION') {
          this.voteTiedMessage = '';
        }
        if (transition.to === 'DIA') {
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
        const duration = payload.reason === 'tie' ? 12000 : 8000;
        this.showStatusMessage(this.voteTiedMessage, 'warn', duration);
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
      this.gameSocket.playerDisconnected$.subscribe(({ playerId, playerName }) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.showStatusMessage(
          `Nodo desconectado: ${playerName ?? playerNameById(this.state, playerId)}`,
          'warn',
        );
      }),
      this.gameSocket.playerReconnected$.subscribe(({ playerId, playerName }) => {
        if (!this.inRoom || this.gameOverActive) return;
        const lastConnected = this.connectedNoticeAt.get(playerId);
        if (lastConnected && Date.now() - lastConnected < 6000) return;
        this.showStatusMessage(
          `Nodo reconectado: ${playerName ?? playerNameById(this.state, playerId)}`,
          'success',
        );
      }),
      this.gameSocket.playerConnected$.subscribe(({ playerId, playerName }) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.connectedNoticeAt.set(playerId, Date.now());
        this.showStatusMessage(
          `Nodo conectado: ${playerName ?? playerNameById(this.state, playerId)}`,
          'success',
        );
      }),
      this.gameSocket.voteTrace$.subscribe((trace) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.gameSound.play('vote');
        this.highlightTrace = trace;
        setTimeout(() => {
          if (this.highlightTrace === trace) {
            this.highlightTrace = null;
          }
        }, 1500);
      }),
      this.gameSocket.chatMessage$.subscribe(() => {
        if (!this.inRoom || this.gameOverActive) return;
        this.gameSound.play('chat');
      }),
      this.gameSocket.publicLog$.subscribe(() => {
        if (!this.inRoom || this.gameOverActive) return;
        this.gameSound.play('warning');
      }),
      this.gameSocket.gameStats$.subscribe((stats) => {
        if (this.gameOverSummary) {
          this.gameOverSummary = { ...this.gameOverSummary, stats };
        }
      }),
      this.gameSocket.error$.subscribe((msg) => {
        this.errorMessage = formatServerErrorForToast(msg);
        this.statusMessageType = 'error';
        setTimeout(() => {
          if (this.errorMessage === formatServerErrorForToast(msg)) this.errorMessage = '';
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
    const code = roomId.toUpperCase().trim();
    this.clearActiveView();
    this.showGameOver = false;
    this.gameOverSummary = null;

    const sub = this.gameSocket.joinOutcome$
      .pipe(
        take(1),
        timeout(8000),
        catchError(() =>
          of({ ok: false, error: 'Tiempo de espera agotado. La sala no respondió.' }),
        ),
      )
      .subscribe((outcome) => {
        if (outcome.ok) {
          this.inRoom = true;
          this.roomCode = code;
        } else {
          this.inRoom = false;
          this.roomCode = '';
          this.errorMessage = outcome.error ?? 'No se pudo entrar a la sala.';
          this.statusMessageType = 'error';
        }
      });
    this.subs.push(sub);
    this.gameSocket.joinRoom(code);
  }

  onBackToLobby(): void {
    this.showThreatBriefing = false;
    this.gameSocket.leaveLobby();
    this.inRoom = false;
    this.roomCode = '';
    this.state = null;
    this.showGameOver = false;
    this.gameOverSummary = null;
    this.clearActiveView();
    this.savedRooms = loadSavedRooms();
  }

  onStartNewGame(): void {
    const max = this.state?.maxPlayers ?? 10;
    this.onBackToLobby();
    setTimeout(() => this.onCreateLobby(max), 300);
  }

  async pruneFinishedSavedRooms(): Promise<void> {
    const rooms = loadSavedRooms();
    const kept: SavedRoom[] = [];
    for (const room of rooms) {
      try {
        const status = await fetchRoomStatus(room.roomId);
        if (isRoomStatusUnavailable(status)) {
          kept.push(room);
        } else if (status.exists && status.phase !== 'FIN') {
          kept.push(room);
        } else {
          removeRoom(room.roomId);
        }
      } catch {
        kept.push(room);
      }
    }
    this.savedRooms = kept;
  }

  async onExportReplay(): Promise<void> {
    if (!this.roomCode || this.exportingReplay) return;
    this.exportingReplay = true;
    try {
      await downloadGameReplay(this.roomCode);
      this.statusMessage = 'Replay descargado';
      this.statusMessageType = 'success';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al exportar replay';
      this.errorMessage = msg;
      this.statusMessageType = 'error';
    } finally {
      this.exportingReplay = false;
    }
  }

  onRemoveSavedRoom(roomId: string): void {
    const code = roomId.toUpperCase().trim();
    this.gameSocket.abandonLobby(code);
    removeRoom(code);
    if (this.roomCode === code) {
      this.inRoom = false;
      this.roomCode = '';
      this.state = null;
      this.clearActiveView();
    }
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

  onSetPhaseConfig(config: Partial<import('./core/models/game-state.model').PhaseConfig>): void {
    this.gameSocket.setPhaseConfig(config);
  }

  toggleSound(): void {
    this.soundMuted = !this.soundMuted;
    this.gameSound.setMuted(this.soundMuted);
  }

  onThreatBriefingDismissed(): void {
    if (this.state?.roomId) {
      sessionStorage.setItem(`fp_threat_${this.state.roomId}`, '1');
    }
    this.showThreatBriefing = false;
  }

  private threatBriefingSeenForRoom(roomId: string): boolean {
    return sessionStorage.getItem(`fp_threat_${roomId}`) === '1';
  }

  private onPhaseSound(phase: GamePhase): void {
    if (phase === 'LOBBY') this.gameSound.play('lobby');
    if (phase === 'DIA' && this.state?.dayNumber === 1) this.gameSound.play('game_start');
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
    durationMs = 6000,
  ): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusMessage = msg;
    this.statusMessageType = type;
    this.statusTimeout = setTimeout(() => {
      if (this.statusMessage === msg) {
        this.statusMessage = '';
        this.statusTimeout = null;
      }
    }, durationMs);
  }

  private startPhaseTimer(): void {
    this.phaseTimerInterval = setInterval(() => {
      const startedAt = this.state?.phaseStartedAt;
      if (!startedAt || !this.inRoom) {
        this.phaseElapsed = '';
        this.phaseCountdown = '';
        return;
      }
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      this.phaseElapsed = `${m}:${s.toString().padStart(2, '0')}`;

      const endsAt = this.state?.phaseEndsAt;
      if (endsAt && this.state?.phaseConfig?.autoAdvance) {
        const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
        const rm = Math.floor(remaining / 60);
        const rs = remaining % 60;
        this.phaseCountdown = `⏱ ${rm}:${rs.toString().padStart(2, '0')}`;
        if (remaining <= 10 && !this.timerWarningFired) {
          this.timerWarningFired = true;
          this.gameSound.play('warning');
        }
      } else {
        this.phaseCountdown = '';
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    if (this.nightPanelTimeout) clearTimeout(this.nightPanelTimeout);
    if (this.phaseTimerInterval) clearInterval(this.phaseTimerInterval);
    this.subs.forEach((s) => s.unsubscribe());
  }
}
