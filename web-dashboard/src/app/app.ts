import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subscription, catchError, of, take, timeout } from 'rxjs';
import { GameSocketService } from './core/services/game-socket.service';
import { GameSoundService } from './core/services/game-sound.service';
import {
  GameOverSummary,
  GamePhase,
  IncidentDisplay,
  NightResolution,
  PublicGameState,
  PublicPlayer,
  SavedRoom,
  VoteTrace,
} from './core/models/game-state.model';
import {
  buildGameOverSummary,
  buildGameOverSummaryFromPayload,
  formatNightResolutionToast,
  formatVoteTiedMessage,
  playerNameById,
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
import { ThreatBriefingComponent } from './features/phases/threat-briefing.component';
import { RoleDistributionOverlayComponent } from './features/phases/role-distribution-overlay.component';
import { HomeAtmosphereComponent } from './features/home-atmosphere/home-atmosphere.component';
import { phaseBulletin } from './core/utils/phase-bulletin.utils';
import { formatServerErrorForToast } from './core/utils/error.utils';
import { downloadGameReplay, downloadSessionLog } from './core/utils/replay.utils';
import { fetchRoomStatus, isRoomStatusUnavailable } from './core/utils/room-status.utils';
import { NodeDeathAlertComponent } from './features/alerts/node-death-alert.component';
import {
  buildNodeDeathAlert,
  NodeDeathAlertData,
} from './core/utils/node-death-alert.utils';

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
    ThreatBriefingComponent,
    RoleDistributionOverlayComponent,
    HomeAtmosphereComponent,
    NodeDeathAlertComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  @ViewChild(TopologyComponent) topology!: TopologyComponent;

  gameSocket = inject(GameSocketService);
  gameSound = inject(GameSoundService);
  private subs: Subscription[] = [];
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;
  private nightPanelTimeout: ReturnType<typeof setTimeout> | null = null;

  inRoom = false;
  roomCode = '';
  savedRooms: SavedRoom[] = [];
  savedRoomConnected: Record<string, number> = {};
  state: PublicGameState | null = null;
  connected = false;
  reconnecting = false;
  incidents: IncidentDisplay[] = [];
  glitchPlayerIds: string[] = [];
  pendingDeathIds: string[] = [];
  showIncidentReport = false;
  incidentNightNumber = 0;
  errorMessage = '';
  voteTiedMessage = '';
  statusMessage = '';
  statusMessageType: 'info' | 'warn' | 'success' | 'error' = 'warn';
  statusToastBottom = false;
  showGameOver = false;
  gameOverSummary: GameOverSummary | null = null;
  phaseFlash: GamePhase | '' = '';
  highlightTrace: VoteTrace | null = null;
  nightResolution: NightResolution | null = null;
  showNightResolution = false;
  lastVoteTiedSkipVotes = 0;
  phaseElapsed = '';
  phaseCountdown = '';
  voteUrgentSeconds = 0;
  soundMuted = false;
  showThreatBriefing = false;
  showRoleDistribution = false;
  phaseBulletinText = '';
  exportingReplay = false;
  exportingSessionLog = false;
  nodeDeathAlert: NodeDeathAlertData | null = null;
  nodeDeathAlertVisible = false;
  nodeDeathAlertExiting = false;
  isHost = false;

  private phaseTimerInterval: ReturnType<typeof setInterval> | null = null;
  private lastPhase: GamePhase | '' = '';
  private deathAlertQueue: NodeDeathAlertData[] = [];
  private deathAlertTimer: ReturnType<typeof setTimeout> | null = null;
  private deathAlertExitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly connectedNoticeAt = new Map<string, number>();
  private savedRoomStatsInterval: ReturnType<typeof setInterval> | null = null;
  private eliminationAnimUntil = 0;
  private static readonly ELIMINATION_ANIM_MS = 2_200;
  private static readonly DEATH_ALERT_MS = 4_200;

  get gameOverActive(): boolean {
    return this.showGameOver || this.state?.phase === 'FIN' || this.gameSocket.isGameEnded;
  }

  /** Partida en curso: ocultar sidebar y dar pantalla completa al tablero. */
  get gameFullscreenMode(): boolean {
    if (!this.inRoom || !this.state || this.gameOverActive) return false;
    return this.state.phase !== 'LOBBY' && this.state.phase !== 'REPARTO';
  }

  ngOnInit(): void {
    this.savedRooms = loadSavedRooms();
    void this.pruneFinishedSavedRooms();
    void this.refreshSavedRoomStats();
    this.savedRoomStatsInterval = setInterval(() => {
      if (!this.inRoom) void this.refreshSavedRoomStats();
    }, 12000);
    this.gameSocket.connect();
    this.startPhaseTimer();
    this.syncAmbientState();

    this.subs.push(
      this.gameSocket.connected$.subscribe((c) => (this.connected = c)),
      this.gameSocket.reconnecting$.subscribe((r) => (this.reconnecting = r)),
      this.gameSocket.roomState$.subscribe((s) => {
        if (!s) return;
        
        if (this.state) {
          const newlyDeadIds = s.players
            .filter(newP => {
              const oldP = this.state!.players.find(p => p.id === newP.id);
              return oldP?.isAlive && !newP.isAlive;
            })
            .map(p => p.id);
            
          if (newlyDeadIds.length > 0) {
            this.pendingDeathIds = [...new Set([...this.pendingDeathIds, ...newlyDeadIds])];
            
            // Retrasar 600ms la muerte visual para dar tiempo al pulso y animación (M27, M28)
            setTimeout(() => {
              this.pendingDeathIds = this.pendingDeathIds.filter(id => !newlyDeadIds.includes(id));
              if (this.state) {
                // Forzar re-render con los jugadores ya muertos
                this.state = { ...this.state };
              }
            }, 600);
          }
        }

        if (this.pendingDeathIds.length > 0) {
          const patchedPlayers = s.players.map(p => {
            if (this.pendingDeathIds.includes(p.id)) return { ...p, isAlive: true };
            return p;
          });
          this.state = { ...s, players: patchedPlayers };
        } else {
          this.state = s;
        }

        if (s && this.inRoom && !this.roomCode) this.roomCode = s.roomId;
        if (s?.phase && s.phase !== this.lastPhase) {
          this.applyPhaseAmbient(s.phase);
          this.phaseBulletinText = phaseBulletin(s.phase);
          const prev = this.lastPhase;
          this.lastPhase = s.phase;
          if (s.phase === 'DIA' && s.dayNumber === 1) {
            this.gameSound.play('game_start');
          }
          if (
            s.phase === 'DIA' &&
            s.dayNumber === 1 &&
            prev === 'LOBBY' &&
            s.roomId &&
            !this.roleDistributionSeenForRoom(s.roomId)
          ) {
            this.showRoleDistribution = true;
            this.showThreatBriefing = false;
          }
        }
        if (
          s?.sessionThreatBrief &&
          s.dayNumber === 1 &&
          s.phase === 'DIA' &&
          !this.threatBriefingSeenForRoom(s.roomId) &&
          !this.showRoleDistribution &&
          this.roleDistributionSeenForRoom(s.roomId)
        ) {
          this.showThreatBriefing = true;
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
        const ids = incidents.map((i) => i.playerId);
        
        this.beginEliminationAnimation(ids);
        this.queueNodeDeathAlerts(ids, 'night_kill');
        
        // Incident report overlay sale DESPUÉS del nodeDeathAlert
        // nodeDeathAlert toma 1600ms en aparecer + 4200ms de duración = 5800ms
        setTimeout(() => {
          this.showIncidentReport = incidents.length > 0;
        }, 5800);

        setTimeout(() => {
          this.showIncidentReport = false;
          this.glitchPlayerIds = [];
          this.incidentNightNumber = 0;
        }, 11_000);
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
          
          if (this.topology) {
            this.topology.triggerEventPulse('victory');
            setTimeout(() => {
              this.showGameOver = true;
            }, 1600); // Esperar que terminen las animaciones VFX antes del Game Over
          } else {
            this.showGameOver = true;
          }

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
        if (transition.at) {
          this.state = this.state
            ? { ...this.state, phaseStartedAt: transition.at, phaseEndsAt: null }
            : this.state;
        }
        this.voteUrgentSeconds = 0;
        if (transition.to === 'NOCHE') this.gameSound.enterNightPhase();
        if (transition.to === 'DIA') this.gameSound.enterDayPhase();
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
        this.gameSound.play('vote_tie');
      }),
      this.gameSocket.nightResolved$.subscribe(({ resolution }) => {
        if (!this.inRoom || this.gameOverActive) return;
        const toast = formatNightResolutionToast(resolution);
        if (toast) {
          this.showStatusMessage(toast, 'warn', 5_000, true);
        }
        if (hasNightResolutionContent(resolution)) {
          this.nightResolution = resolution;
          this.showNightResolution = true;
          if (this.nightPanelTimeout) clearTimeout(this.nightPanelTimeout);
          this.nightPanelTimeout = setTimeout(() => {
            this.showNightResolution = false;
            this.nightPanelTimeout = null;
          }, 8_000);
        }
      }),
      this.gameSocket.playerEliminated$.subscribe(({ playerId, reason, role }) => {
        if (!this.inRoom || this.gameOverActive) return;
        const isVote = reason === 'vote';
        this.gameSound.play(isVote ? 'death' : 'node_leave');
        this.patchPlayersAlive([playerId], false);
        this.beginEliminationAnimation([playerId]);
        this.queueNodeDeathAlerts([playerId], reason, role);
      }),
      this.gameSocket.playerDisconnected$.subscribe(({ playerId, playerName }) => {
        if (!this.inRoom || this.gameOverActive) return;
        this.gameSound.play('node_leave');
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
        if (this.state?.players.find((p) => p.id === playerId)?.isBot) return;
        this.connectedNoticeAt.set(playerId, Date.now());
        this.gameSound.play('node_join');
        this.showStatusMessage(
          `Nodo conectado: ${playerName ?? playerNameById(this.state, playerId)}`,
          'success',
        );
      }),
      this.gameSocket.voteTrace$.subscribe((trace) => {
        if (!this.inRoom || this.gameOverActive) return;
        if (this.state?.phaseConfig?.botQaAutoRun) {
          this.gameSound.playThrottled('vote', 3_000);
        } else {
          this.gameSound.play('vote');
        }
        this.highlightTrace = trace;
        setTimeout(() => {
          if (this.highlightTrace === trace) {
            this.highlightTrace = null;
          }
        }, 1500);
      }),
      this.gameSocket.chatMessage$.subscribe((message) => {
        if (!this.inRoom || this.gameOverActive) return;
        if (message.channel !== 'public') return;
        this.gameSound.play('chat');
      }),
      this.gameSocket.publicLog$.subscribe((entry) => {
        if (!this.inRoom || this.gameOverActive) return;
        if (this.state?.phaseConfig?.botQaAutoRun && entry.message.includes('[BOT/QA]')) return;
        if (entry.severity === 'critical') {
          this.gameSound.playThrottled('incident', 4_000);
        }
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
      this.gameSocket.info$.subscribe((msg) => {
        this.showStatusMessage(msg, 'info', 50000, true);
      }),
    );
  }

  onCreateLobby(maxPlayers: number): void {
    this.isHost = true;
    const code = this.gameSocket.createLobby(maxPlayers);
    saveRoom({ roomId: code, maxPlayers, savedAt: Date.now() });
    this.savedRooms = loadSavedRooms();
    void this.refreshSavedRoomStats();
    this.inRoom = true;
    this.roomCode = code;
    this.clearActiveView();
    this.showGameOver = false;
    this.gameOverSummary = null;
    this.lastPhase = '';
    this.syncAmbientState();
  }

  onRejoinRoom(roomId: string): void {
    const code = roomId.toUpperCase().trim();
    this.isHost = true;
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
          this.lastPhase = '';
          this.syncAmbientState();
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

  onSpectateLobby(roomId: string): void {
    const code = roomId.toUpperCase().trim();
    this.isHost = false;
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
          this.lastPhase = '';
          this.syncAmbientState();
        } else {
          this.inRoom = false;
          this.roomCode = '';
          this.errorMessage = outcome.error ?? 'No se pudo encontrar la sala para espectar.';
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
    this.lastPhase = '';
    this.syncAmbientState();
  }

  onStartNewGame(): void {
    const max = this.state?.maxPlayers ?? 10;
    this.onBackToLobby();
    setTimeout(() => this.onCreateLobby(max), 300);
  }

  async refreshSavedRoomStats(): Promise<void> {
    const rooms = loadSavedRooms();
    const next: Record<string, number> = { ...this.savedRoomConnected };
    await Promise.all(
      rooms.map(async (room) => {
        try {
          const status = await fetchRoomStatus(room.roomId);
          if (!isRoomStatusUnavailable(status) && status.exists) {
            next[room.roomId] = status.connectedCount ?? status.playerCount ?? 0;
          }
        } catch {
          /* conservar último valor conocido */
        }
      }),
    );
    this.savedRoomConnected = next;
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

  async onExportSessionLog(): Promise<void> {
    if (!this.roomCode || this.exportingSessionLog) return;
    this.exportingSessionLog = true;
    try {
      await downloadSessionLog(this.roomCode);
      this.statusMessage = 'Registro .log descargado';
      this.statusMessageType = 'success';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar registro';
      this.errorMessage = msg;
      this.statusMessageType = 'error';
    } finally {
      this.exportingSessionLog = false;
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
    void this.refreshSavedRoomStats();
  }

  onStartGame(): void {
    if (this.gameOverActive) return;
    this.gameSocket.startGame();
  }

  onFillBots(): void {
    if (this.gameOverActive) return;
    this.gameSocket.fillBots();
  }

  onClearBots(): void {
    if (this.gameOverActive) return;
    this.gameSocket.clearBots();
  }

  onKickPlayer(player: PublicPlayer): void {
    if (this.gameOverActive || this.state?.phase !== 'LOBBY') return;
    this.gameSocket.kickPlayer(player.id);
  }

  onRunBotQaMatch(): void {
    if (this.gameOverActive) return;
    this.gameSocket.runBotQaMatch();
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
    if (!this.soundMuted) {
      this.syncAmbientState();
    }
  }

  onThreatBriefingDismissed(): void {
    if (this.state?.roomId) {
      sessionStorage.setItem(`fp_threat_${this.state.roomId}`, '1');
    }
    this.showThreatBriefing = false;
  }

  onRoleDistributionDismissed(): void {
    if (this.state?.roomId) {
      sessionStorage.setItem(`fp_role_dist_${this.state.roomId}`, '1');
    }
    this.showRoleDistribution = false;
    if (
      this.state?.sessionThreatBrief &&
      this.state.dayNumber === 1 &&
      !this.threatBriefingSeenForRoom(this.state.roomId)
    ) {
      this.showThreatBriefing = true;
    }
  }

  private roleDistributionSeenForRoom(roomId: string): boolean {
    return sessionStorage.getItem(`fp_role_dist_${roomId}`) === '1';
  }

  private threatBriefingSeenForRoom(roomId: string): boolean {
    return sessionStorage.getItem(`fp_threat_${roomId}`) === '1';
  }

  private applyPhaseAmbient(phase: GamePhase): void {
    switch (phase) {
      case 'LOBBY':
        this.gameSound.startLobbyAmbient();
        break;
      case 'NOCHE':
        this.gameSound.startNightAmbient();
        break;
      case 'REPARTO':
      case 'DIA':
      case 'VOTACION':
      case 'FIN':
        this.gameSound.stopAmbient();
        break;
    }
  }

  /** Sincroniza loops según pantalla actual (home vs sala) y fase de partida. */
  private syncAmbientState(): void {
    if (this.soundMuted) return;
    if (!this.inRoom) {
      this.gameSound.startLobbyAmbient();
      return;
    }
    if (this.state?.phase) {
      this.applyPhaseAmbient(this.state.phase);
    }
  }

  private clearActiveView(): void {
    this.incidents = [];
    this.showIncidentReport = false;
    this.glitchPlayerIds = [];
    this.pendingDeathIds = [];
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
    this.clearNodeDeathAlerts();
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
    bottom = false,
  ): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusMessage = msg;
    this.statusMessageType = type;
    this.statusToastBottom = bottom;
    this.statusTimeout = setTimeout(() => {
      if (this.statusMessage === msg) {
        this.statusMessage = '';
        this.statusToastBottom = false;
        this.statusTimeout = null;
      }
    }, durationMs);
  }

  private beginEliminationAnimation(playerIds: string[]): void {
    if (!playerIds.length) return;
    this.eliminationAnimUntil = Date.now() + App.ELIMINATION_ANIM_MS;
    this.glitchPlayerIds = [...new Set([...this.glitchPlayerIds, ...playerIds])];
    setTimeout(() => {
      const remaining = this.glitchPlayerIds.filter((id) => !playerIds.includes(id));
      this.glitchPlayerIds = remaining;
    }, App.ELIMINATION_ANIM_MS);
  }

  private queueNodeDeathAlerts(playerIds: string[], reason: string, explicitRole?: string): void {
    const playersData = playerIds.map((id) => {
      const player = this.state?.players.find(p => p.id === id);
      return { id, name: player?.name ?? id, role: explicitRole ?? player?.role };
    });
    const alert = buildNodeDeathAlert(playersData, reason);
    if (!alert) return;
    this.deathAlertQueue.push(alert);
    this.pumpNodeDeathAlertQueue();
  }

  private pumpNodeDeathAlertQueue(): void {
    if (this.nodeDeathAlertVisible || !this.deathAlertQueue.length) return;

    if (this.deathAlertTimer) {
      clearTimeout(this.deathAlertTimer);
      this.deathAlertTimer = null;
    }
    if (this.deathAlertExitTimer) {
      clearTimeout(this.deathAlertExitTimer);
      this.deathAlertExitTimer = null;
    }

    this.nodeDeathAlert = this.deathAlertQueue.shift() ?? null;
    if (!this.nodeDeathAlert) return;

    this.nodeDeathAlertExiting = false;

    // Disparar pulso en topología
    let pulseType: 'kill' | 'vote' = this.nodeDeathAlert.reason === 'vote' ? 'vote' : 'kill';
    let targetId = this.nodeDeathAlert.players[0]?.id;
    if (this.topology) {
      this.topology.triggerEventPulse(pulseType, targetId);
    }

    // Retrasar modal para que no tape el pulso ni las animaciones (M27, M28)
    setTimeout(() => {
      this.nodeDeathAlertVisible = true;

      this.deathAlertTimer = setTimeout(() => {
        this.nodeDeathAlertExiting = true;
        this.deathAlertExitTimer = setTimeout(() => {
          this.nodeDeathAlertVisible = false;
          this.nodeDeathAlert = null;
          this.nodeDeathAlertExiting = false;
          this.deathAlertTimer = null;
          this.deathAlertExitTimer = null;
          this.pumpNodeDeathAlertQueue();
        }, 420);
      }, App.DEATH_ALERT_MS);
    }, 1600); // 1600ms de retraso para que las animaciones respiren
  }

  private clearNodeDeathAlerts(): void {
    this.deathAlertQueue = [];
    if (this.deathAlertTimer) clearTimeout(this.deathAlertTimer);
    if (this.deathAlertExitTimer) clearTimeout(this.deathAlertExitTimer);
    this.deathAlertTimer = null;
    this.deathAlertExitTimer = null;
    this.nodeDeathAlertVisible = false;
    this.nodeDeathAlertExiting = false;
    this.nodeDeathAlert = null;
  }

  /** Marca jugadores muertos/vivos de inmediato (antes del publicState del servidor). */
  private patchPlayersAlive(playerIds: string[], isAlive: boolean): void {
    if (!this.state || !playerIds.length) return;
    const idSet = new Set(playerIds);
    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        idSet.has(p.id) ? { ...p, isAlive } : p,
      ),
    };
  }

  private startPhaseTimer(): void {
    this.phaseTimerInterval = setInterval(() => {
      const matchStart = this.resolveMatchStartedAt();
      if (!matchStart || !this.inRoom) {
        this.phaseElapsed = '';
        this.phaseCountdown = '';
        this.voteUrgentSeconds = 0;
        return;
      }
      const secs = Math.floor((Date.now() - matchStart) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      this.phaseElapsed = `${m}:${s.toString().padStart(2, '0')}`;

      const endsAt = this.resolvePhaseEndsAt();
      if (endsAt && this.state?.phaseConfig?.autoAdvance) {
        const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
        const rm = Math.floor(remaining / 60);
        const rs = remaining % 60;
        this.phaseCountdown = `⏱ ${rm}:${rs.toString().padStart(2, '0')}`;
        if (this.state?.phase === 'VOTACION' && remaining > 0 && remaining <= 10) {
          this.voteUrgentSeconds = remaining;
        } else {
          this.voteUrgentSeconds = 0;
        }
      } else {
        this.phaseCountdown = '';
        this.voteUrgentSeconds = 0;
      }
    }, 1000);
  }

  get blockPhaseOverlays(): boolean {
    return (
      this.nodeDeathAlertVisible ||
      this.glitchPlayerIds.length > 0 ||
      this.deathAlertQueue.length > 0
    );
  }

  private resolveMatchStartedAt(): number | null {
    const s = this.state;
    if (!s || s.phase === 'LOBBY') return null;
    return s.gameStartedAt ?? s.phaseStartedAt ?? null;
  }

  private resolvePhaseEndsAt(): number | null {
    const s = this.state;
    if (!s) return null;
    if (s.phaseEndsAt) return s.phaseEndsAt;
    if (!s.phaseConfig?.autoAdvance || !s.phaseStartedAt) return null;
    const cfg = s.phaseConfig;
    let ms = 0;
    switch (s.phase) {
      case 'NOCHE':
        ms = cfg.nightDurationMs;
        break;
      case 'DIA':
        ms = cfg.dayDurationMs;
        break;
      case 'VOTACION':
        ms = cfg.voteDurationMs;
        break;
      case 'VERIFICACION':
        ms = 1_500;
        break;
      default:
        return null;
    }
    return ms > 0 ? s.phaseStartedAt + ms : null;
  }

  ngOnDestroy(): void {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    if (this.nightPanelTimeout) clearTimeout(this.nightPanelTimeout);
    if (this.phaseTimerInterval) clearInterval(this.phaseTimerInterval);
    if (this.savedRoomStatsInterval) clearInterval(this.savedRoomStatsInterval);
    this.subs.forEach((s) => s.unsubscribe());
  }
}
