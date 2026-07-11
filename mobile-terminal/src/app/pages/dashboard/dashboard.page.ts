import { LucideAngularModule } from 'lucide-angular';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, Platform, AlertController, ToastController, ActionSheetController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  GamePhase,
  PlayerRoomState,
  RoomPlayer,
  TargetOption,
} from '../../core/models/game-state.model';
import {
  SocketService,
} from '../../services/socket/socket.service';
import { AuthService } from '../../services/auth/auth.service';
import { evaluateEndOfGameAchievements } from '../../core/utils/achievements.eval';
import {
  getNightActionLabel,
  getNightActionType,
  getNightActionVariants,
  getRoleStatusLines,
  needsSecondaryTarget,
  getSecondaryTargetLabel,
  isTrollProvoke,
  isNoiseBurst,
  isMirageCloak,
  isJamSignal,
  isIntelPulse,
  WHITE_NOISE_MESSAGES,
  isMinerRole,
  canUseEmergencyPatch,
  canCryptoBribe,
  TROLL_PROVOKE_MESSAGES,
} from '../../core/role-actions';
import { GameSoundService } from '../../services/game-sound.service';
import { TextChallengeComponent } from '../../components/text-challenge/text-challenge.component';
import { LobbyClosedOverlayComponent } from '../../components/lobby-closed-overlay/lobby-closed-overlay.component';
import { HomeAtmosphereComponent } from '../../components/home-atmosphere/home-atmosphere.component';
import { NodePickerComponent } from '../../components/node-picker/node-picker.component';
import {
  ChatMessage,
  MinigameChallenge,
  NightProgress,
  GameStatsEntry,
} from '../../core/models/game-state.model';
import {
  deadPlayerRoleLabel,
  formatVoteTiedMessage,
  getEliminatedIdsFromIncident,
  infectionSourceLabel,
  isNodeCritical,
  mergeChatMessages,
  phaseLabel,
  translateEliminationReason,
} from '../../core/utils/game.utils';
import { formatServerErrorForToast, parseChatCooldownSeconds } from '../../core/utils/error.utils';
import { fetchRoomStatus, isRoomStatusUnavailable } from '../../core/utils/room-status.utils';
import { playersPerBlackHatForTable } from '../../core/utils/room-code.utils';
import { phaseBulletin } from '../../core/utils/phase-bulletin.utils';
import { buildGameOverView, GameOverView } from '../../core/utils/game-over.utils';
import {
  buildThreatBriefingView,
  SessionThreatBrief,
  ThreatBriefingView,
} from '../../core/utils/session-threat-copy.utils';
import {
  buildPendingReport,
  buildPrivateResultReport,
  buildResolvedReport,
  NightActionReport,
  PendingNightAction,
} from '../../core/utils/night-result.utils';
import { getPlayerNodeBadge } from '../../core/utils/player-visibility.utils';
import { formatRoleCopy } from '../../core/utils/role-copy.utils';
import {
  buildNodeDeathAlert,
  NodeDeathAlertData,
} from '../../core/utils/node-death-alert.utils';
import { MIN_PLAYERS_TO_START, MAX_PLAYERS, PLAYERS_PER_CHAOTIC_ROLE, PlayerRoleMeta } from '../../core/models/game-state.model';
import { Subscription } from 'rxjs';
import { HapticService } from '../../services/haptic.service';
import { LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule, TextChallengeComponent, LobbyClosedOverlayComponent, HomeAtmosphereComponent, NodePickerComponent, LucideAngularModule],
})
export class DashboardPage implements OnInit, OnDestroy {
  getReportIcon(line: string): string | null {
    if (line.includes('⚠') || line.includes('☣')) return 'alert-triangle';
    if (line.includes('✓') || line.includes('✅')) return 'check-circle';
    if (line.includes('🛡️')) return 'shield-check';
    if (line.includes('🩸') || line.includes('💀')) return 'skull';
    return null;
  }

  getReportText(line: string): string {
    return line.replace(/[⚠☣✓✅🛡️🩸💀]/g, '').trim();
  }

  readonly minPlayers = MIN_PLAYERS_TO_START;
  readonly playersPerChaotic = PLAYERS_PER_CHAOTIC_ROLE;
  maxPlayers = MAX_PLAYERS;
  myInfectionMaturesAfterNight: number | null = null;
  myInfectionSource: string | null = null;
  myRoleMeta: PlayerRoleMeta | undefined;
  roleStatusLines: string[] = [];
  voteTiedMessage = '';
  lastNightKillNames: string[] = [];
  topologyOpen = false;
  activeControlTab: 'mission' | 'intel' | 'network' | 'comms' = 'mission';
  soundMuted = true;
  nightHistory: NightActionReport[] = [];
  showPatchConfirm = false;

  playerName = 'Esperando red...';
  playerRole = 'Desconocido';
  playerTeamLabel = '';
  roleDescription = '';
  nightActionHint = '';
  gamePhase: GamePhase | 'ELIMINATED' = 'LOBBY';
  roomCode = '';
  dayNumber = 0;
  nightNumber = 0;
  connected = false;
  reconnecting = false;
  chatCooldownSec = 0;
  isSilenced = false;
  isFrozen = false;

  aliveTargets: TargetOption[] = [];
  deadTargets: TargetOption[] = [];
  allPlayers: TargetOption[] = [];
  players: RoomPlayer[] = [];

  selectedTarget = '';
  selectedSecondary = '';
  statusMessage = '';
  statusType: 'info' | 'success' | 'error' | 'warn' = 'info';
  canActAtNight = false;
  selectedNightActionType = '';
  nightActionReport: NightActionReport | null = null;

  incidentNames: string[] = [];
  showIncidentReport = false;
  phaseFlash = '';
  phaseBanner = '';
  gameOverView: GameOverView | null = null;
  showGameOver = false;
  myVoteConfirmed = false;
  myTeam: string | undefined;
  hackerTeamMemberIds: string[] = [];
  showRoleBriefing = false;
  showRoleGuide = false;
  showThreatBriefing = false;
  showRoleList = false;

  showLastWillModal = false;
  lastWillText = '';
  lastWillSecondsLeft = 10;
  private lastWillInterval: any;
  roleListLines: string[] = [];
  roleRevealTeam = '';
  roleVictoryHint = '';
  roleBriefingProgress = 100;
  threatBriefingProgress = 100;
  threatBriefingView: ThreatBriefingView | null = null;
  sessionThreatBrief: SessionThreatBrief | null = null;
  phaseBulletin = '';
  voteUrgentSeconds = 0;
  phaseCountdown = '';
  phaseRemainingSeconds = 0;
  phaseTotalSeconds = 0;
  matchElapsed = '';
  nightProgress: NightProgress | null = null;
  minigameChallenge: MinigameChallenge | null = null;
  minigamePending = false;
  minigameFeedbackType: 'none' | 'success' | 'error' = 'none';
  minigameFeedbackMessage = '';
  interferenceShake = false;
  deathShake = false;
  miniShake = false;

  @ViewChild('chatList') chatListRef?: ElementRef<HTMLElement>;
  isChatScrolledUp = false;
  showNewMessageBadge = false;
  showDeathFlash = false;
  challengeAnswer: string | number | null = null;
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  chatOpen = false;
  chatChannel: 'public' | 'dead' | 'hacker' = 'public';
  chatChannelOptions: { value: 'public' | 'dead' | 'hacker'; label: string }[] = [
    { value: 'public', label: 'Público' },
  ];
  selectedProvokeIndex = 0;
  gameStats: GameStatsEntry[] = [];
  showLobbyClosedOverlay = false;
  lobbyClosedRoomId = '';
  lobbyClosedReason: 'host_abandoned' | 'player_kicked' = 'host_abandoned';
  nodeDeathAlert: NodeDeathAlertData | null = null;
  showNodeDeathAlert = false;
  nodeDeathAlertExiting = false;
  readonly trollMessages = TROLL_PROVOKE_MESSAGES;
  readonly canCryptoBribe = canCryptoBribe;
  isNightActionMinimized = false;
  voteCeremonyActive = false;
  selectedEmergencyTarget = '';
  gameOverStep = 0;
  myDeathReason: string | null = null;
  lastGameState: PlayerRoomState | null = null;

  private subs = new Subscription();

  minimizeNightAction() {
    this.isNightActionMinimized = true;
  }

  restoreNightAction() {
    this.isNightActionMinimized = false;
  }
  private pendingNightAction: PendingNightAction | null = null;
  myPlayerId = localStorage.getItem('myPlayerId') ?? '';
  private incidentTimer?: ReturnType<typeof setTimeout>;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private statusTimer?: ReturnType<typeof setTimeout>;
  private roleBriefingTimer?: ReturnType<typeof setInterval>;
  private roleBriefingHideTimer?: ReturnType<typeof setTimeout>;
  private threatBriefingTimer?: ReturnType<typeof setInterval>;
  private threatBriefingHideTimer?: ReturnType<typeof setTimeout>;
  private chatCooldownTimer?: ReturnType<typeof setInterval>;
  private roomStatusTimer?: ReturnType<typeof setInterval>;
  private lobbyClosedAlertOpen = false;
  private deathHapticTriggered = false;
  private pendingMinigameAnswer: string | number | null = null;
  private interferenceTimer?: ReturnType<typeof setTimeout>;
  private phaseTimerInterval?: ReturnType<typeof setInterval>;
  private phaseEndsAt: number | null = null;
  private lastPhase: GamePhase | '' = '';
  private lastHapticSecond = -1;
  private timerExpiredPlayed = false;
  private deathAlertQueue: NodeDeathAlertData[] = [];
  private deathAlertTimer?: ReturnType<typeof setTimeout>;
  private deathAlertExitTimer?: ReturnType<typeof setTimeout>;
  private static readonly DEATH_ALERT_MS = 4_200;
  private phaseStartedAt = 0;
  private gameStartedAt = 0;
  private phaseConfig: PlayerRoomState['phaseConfig'];
  private readonly roleBriefingDurationMs = 20000;
  private readonly threatBriefingDurationMs = 20000;

  constructor(
    private socketService: SocketService,
    private router: Router,
    private gameSound: GameSoundService,
    private platform: Platform,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private hapticService: HapticService,
    private actionSheetCtrl: ActionSheetController
  ) {}

  private backButtonSub?: Subscription;

  ionViewDidEnter() {
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(10, () => {
      if (this.showIncidentReport) {
        this.showIncidentReport = false;
      } else if (this.showRoleBriefing) {
        this.showRoleBriefing = false;
      } else if (this.showThreatBriefing) {
        this.showThreatBriefing = false;
      } else if (this.showRoleGuide) {
        this.showRoleGuide = false;
      } else if (this.showRoleList) {
        this.showRoleList = false;
      } else if (this.showPatchConfirm) {
        this.showPatchConfirm = false;
      } else if (this.showNodeDeathAlert) {
        this.showNodeDeathAlert = false;
      } else {
        this.confirmLeave();
      }
    });
  }

  ionViewWillLeave() {
    this.backButtonSub?.unsubscribe();
  }

  private cleanupAndExit() {
    try {
      sessionStorage.removeItem(this.hackerTeamStorageKey());
    } catch {
      /* ignore */
    }
    this.hackerTeamMemberIds = [];
    this.socketService.leaveRoom();
    this.socketService.clearSession();
    void this.router.navigate(['/login']);
  }

  async confirmLeave() {
    if (this.gamePhase === 'LOBBY' || this.gamePhase === 'FIN') {
      this.cleanupAndExit();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: '¿Abandonar Partida?',
      message: 'La partida está en curso. Si sales ahora, tu nodo será desconectado y quedarás eliminado (baneado).',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Salir y ser Baneado',
          role: 'destructive',
          handler: () => {
            this.cleanupAndExit();
          }
        }
      ],
      cssClass: 'cyber-alert'
    });

    await alert.present();
  }

  async copyRoomCode() {
    if (!this.roomCode) return;
    try {
      await navigator.clipboard.writeText(this.roomCode);
      const toast = await this.toastCtrl.create({
        message: '✁ECódigo copiado',
        duration: 2000,
        position: 'top',
        color: 'dark',
        cssClass: 'cyber-toast',
      });
      await toast.present();
    } catch (e) {
      this.setStatus('Error al copiar el código', 'error');
    }
  }

  ionViewWillEnter(): void {
    this.roomCode = localStorage.getItem('roomCode') ?? '';
    this.myPlayerId = localStorage.getItem('myPlayerId') ?? '';
  }

  ngOnInit(): void {
    this.roomCode = localStorage.getItem('roomCode') ?? '';
    this.myPlayerId = localStorage.getItem('myPlayerId') ?? '';

    if (!this.socketService.reconnectFromStorage()) {
      this.router.navigate(['/login']);
      return;
    }

    this.socketService.ensureConnection();
    void LocalNotifications.requestPermissions();

    this.gameSound.setMuted(this.soundMuted);
    void this.gameSound.unlockAudio();
    this.restoreHackerTeamFromStorage();

    this.subs.add(
      this.socketService.connected$.subscribe((c) => {
        this.connected = c;
      }),
    );

    this.subs.add(
      this.socketService.reconnecting$.subscribe((r) => {
        this.reconnecting = r;
      }),
    );

    this.subs.add(
      this.socketService.gameState$.subscribe((state) => {
        this.lastGameState = state;
        if (state.roomId) this.roomCode = state.roomId;
        this.dayNumber = state.dayNumber ?? 0;
        this.nightNumber = state.nightNumber ?? 0;
        this.maxPlayers = state.maxPlayers ?? MAX_PLAYERS;
        this.phaseStartedAt = state.phaseStartedAt ?? Date.now();
        this.gameStartedAt = state.gameStartedAt ?? 0;
        this.phaseEndsAt = state.phaseEndsAt ?? null;
        this.phaseConfig = state.phaseConfig;

        this.players = state.players ?? [];
        const me = this.players.find((p) => p.id === this.myPlayerId);
        if (me?.team) this.myTeam = me.team;
        if (me) this.isFrozen = !!me.frozen;
        if (
          (this.myTeam === 'black_hat' || me?.team === 'black_hat') &&
          !this.hackerTeamMemberIds.length
        ) {
          this.restoreHackerTeamFromStorage();
        }

        const gameEnded = state.phase === 'FIN' || !!state.winner || !!state.soloWinner;

        if (gameEnded) {
          this.handleGameOver(state.winner, state.soloWinner);
        } else if (state.phase === 'LOBBY' || state.phase === 'REPARTO') {
          if (this.gamePhase !== state.phase) {
            this.isNightActionMinimized = false;
          }
          this.gamePhase = state.phase;
          this.showGameOver = false;
          this.gameOverView = null;
          this.gameOverStep = 0;
        } else if (me && !me.isAlive) {
          this.transitionToEliminated();
        } else if (state.phase) {
          if (this.gamePhase !== state.phase) {
            this.isNightActionMinimized = false;
          }
          this.gamePhase = state.phase;
          this.phaseBulletin = phaseBulletin(state.phase);
          this.syncNightSoundPolicy(state.phase);
          this.refreshChatChannelOptions();
        }

        this.allPlayers = this.players.map((p) => ({
          id: p.id,
          name: p.name,
          avatarUrl: p.avatarUrl,
          isAlive: p.isAlive,
          isConnected: p.isConnected,
        }));

        this.aliveTargets = this.syncTargetList(
          this.aliveTargets,
          this.players
            .filter((p) => p.isAlive && p.id !== this.myPlayerId)
            .map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, isAlive: true, isConnected: p.isConnected })),
        );

        this.deadTargets = this.syncTargetList(
          this.deadTargets,
          this.players
            .filter((p) => !p.isAlive)
            .map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, isAlive: false, isConnected: p.isConnected })),
        );

        if (
          this.selectedTarget &&
          !this.aliveTargets.some((t) => t.id === this.selectedTarget) &&
          !this.deadTargets.some((t) => t.id === this.selectedTarget)
        ) {
          this.selectedTarget = '';
        }

        this.syncInfectionFromState(me);
        this.syncRoleMeta(me);

        if (state.nightProgress) this.nightProgress = state.nightProgress;
        if (state.chatMessages?.length) {
          this.chatMessages = mergeChatMessages(this.chatMessages, state.chatMessages);
        }
        if (state.gameStats) this.gameStats = state.gameStats;
        if (state.sessionThreatBrief) this.sessionThreatBrief = state.sessionThreatBrief;

        if (
          state.sessionThreatBrief &&
          state.dayNumber === 1 &&
          state.phase === 'DIA' &&
          this.roomCode &&
          this.roleBriefingSeenForRoom(this.roomCode) &&
          !this.threatBriefingSeenForRoom(this.roomCode) &&
          !this.showRoleBriefing &&
          !this.showThreatBriefing
        ) {
          this.openThreatBriefing();
        }

        this.updateRoleList();

        if (state.lastNightKills?.length) {
          this.lastNightKillNames = state.lastNightKills.map(
            (id) => this.players.find((p) => p.id === id)?.name ?? id,
          );
        } else if (state.phase === 'DIA') {
          this.lastNightKillNames = [];
        }
      }),
    );

    this.subs.add(
      this.socketService.playerState$.subscribe((player) => {
        if (player.name) this.playerName = player.name;
        if (player.role) {
          this.playerRole = player.role;
          const roleKey = player.roleId ?? player.role;
          this.canActAtNight =
            !!getNightActionType(roleKey) || getNightActionVariants(roleKey).length > 0;
          const variants = getNightActionVariants(roleKey);
          if (variants.length && !this.selectedNightActionType) {
            this.selectedNightActionType = variants[0].value;
          }
        }
        if (player.teamLabel) this.playerTeamLabel = player.teamLabel;
        if (player.team) this.myTeam = player.team;
        this.refreshChatChannelOptions();
        if (player.roleDescription) this.roleDescription = formatRoleCopy(player.roleDescription);
        if (player.nightActionHint) this.nightActionHint = player.nightActionHint;
        if (player.isDead && !this.showGameOver && this.gamePhase !== 'FIN') {
          this.transitionToEliminated();
        }
        this.isSilenced = !!player.silenced;
        this.isFrozen = !!player.frozen;
      }),
    );

    this.subs.add(
      this.socketService.privateResult$.subscribe((payload) => {
        if (payload.type === 'scan') {
          const labels: Record<string, string> = {
            malicious: 'MALICIOSO',
            suspicious: 'SOSPECHOSO',
            safe: 'SEGURO',
          };
          const result = labels[payload.result ?? 'safe'] ?? payload.result;
          this.setStatus(`Escaneo: ${result}`, 'info');
          void this.runScanHaptic(payload.result);
        }
        if (payload.type === 'hacker_team') {
          this.hackerTeamMemberIds = payload.members ?? [];
          this.persistHackerTeam(this.hackerTeamMemberIds);
          const names = this.hackerTeamMemberIds
            .map((id: string) => this.players.find((p) => p.id === id)?.name ?? id)
            .join(', ');
          this.setPersistentRoleInfo('Equipo Black Hat', [
            `Compañeros: ${names || (payload.members ?? []).length + ' nodos'}`,
            'Coordinad vuestras acciones nocturnas.',
          ]);
        }
        if (payload.type === 'spy') {
          const visitors = (payload.visitors ?? []).length;
          this.setStatus(`Espionaje: ${visitors} visitantes detectados`, 'info');
        }
        if (payload.type === 'role_assigned') {
          this.setStatus(`Rol asignado: ${payload.displayName ?? payload.role}`, 'success');
          if (payload.description) this.roleDescription = formatRoleCopy(payload.description);
          if (payload.nightActionHint) this.nightActionHint = formatRoleCopy(payload.nightActionHint);
          if (payload.teamLabel) this.playerTeamLabel = payload.teamLabel;
          if (payload.displayName) this.playerRole = payload.displayName;
          this.roleVictoryHint = formatRoleCopy(payload.victoryHint ?? '');
          const roleKey = payload.role ?? '';
          this.selectedNightActionType = '';
          this.canActAtNight = !!getNightActionType(roleKey);
          const variants = getNightActionVariants(roleKey);
          if (variants.length) {
            this.selectedNightActionType = variants[0].value;
          }
          if (!this.roleBriefingSeenForRoom(this.roomCode)) {
            this.openRoleBriefing(payload.team ?? '');
          }
          this.updateRoleList();
        }
        if (payload.type === 'infection_warning') {
          this.myInfectionSource = payload.infectionSource ?? 'worm';
          this.setStatus(
            payload.critical
              ? '☣ Infección crítica  Ecaerás al amanecer si no te curaron'
              : `☣ Infectado por ${infectionSourceLabel(payload.infectionSource)}  Ebusca Antivirus`,
            'error',
          );
        }
        if (payload.type === 'infected') {
          const name = this.players.find((p) => p.id === payload.targetId)?.name ?? payload.targetId;
          this.setStatus(`Infección enviada a ${name}`, 'success');
        }
        if (payload.type === 'cured') {
          const name = this.players.find((p) => p.id === payload.targetId)?.name ?? payload.targetId;
          this.setStatus(`Infección curada en ${name}`, 'success');
          if (payload.targetId === this.myPlayerId) {
            this.myInfectionMaturesAfterNight = null;
            this.myInfectionSource = null;
          }
        }
        if (payload.type === 'miner_update') {
          if (payload.shieldCharges != null && this.myRoleMeta) {
            this.myRoleMeta = { ...this.myRoleMeta, shieldCharges: payload.shieldCharges };
            this.syncRoleMeta(this.players.find((p) => p.id === this.myPlayerId));
          }
        }

        const report = buildPrivateResultReport(payload, this.players, this.nightNumber);
        if (report) {
          this.nightActionReport = report;
          if (report.status === 'resolved') this.pushNightHistory(report);
        }
      }),
    );

    this.subs.add(
      this.socketService.phaseTransition$.subscribe((t) => {
        const me = this.players.find((p) => p.id === this.myPlayerId);
        const amDead = !!(me && !me.isAlive);
        if (!amDead) {
          this.gamePhase = t.to;
          this.triggerPhaseFlash(t.to);
          void this.runPhaseHaptic(t.to);
          this.phaseBulletin = phaseBulletin(t.to);
          this.syncNightSoundPolicy(t.to);
        }
        if (t.at) {
          this.phaseStartedAt = t.at;
          this.phaseEndsAt = null;
        }
        if (t.to === 'DIA' && !amDead) this.gameSound.playDay();
        if (t.to !== this.lastPhase) {
          this.lastHapticSecond = -1;
          this.timerExpiredPlayed = false;
        }
        this.lastPhase = t.to;
        this.minigameChallenge = null;
        this.challengeAnswer = null;
        this.minigamePending = false;
        this.minigameFeedbackType = 'none';
        this.minigameFeedbackMessage = '';
        if (!amDead && this.canActAtNight) this.socketService.requestMinigame();
        if (!amDead) this.syncChatForPhase({ forceChannel: true });
        
        if (t.to === 'DIA' && !amDead) {
          this.setStatus('Amanecer  Eauditoría diurna iniciada', 'info');
        }
        if (t.to === 'NOCHE' && !amDead) {
          this.setStatus('Modo sigilo activado', 'warn');
          if (this.canActAtNight) {
            void LocalNotifications.schedule({
              notifications: [{
                id: Date.now(),
                title: 'Es tu turno',
                body: 'Ejecuta tu acción nocturna en la red.',
              }]
            });
          }
          this.topologyOpen = false;
          this.selectedTarget = '';
          this.selectedSecondary = '';
          if (!this.isInfected) {
            this.nightActionReport = null;
          }
        }
        if (t.to === 'DIA' && !amDead) {
          this.topologyOpen = true;
        }
        if (t.to === 'VOTACION' && !amDead) {
          this.myVoteConfirmed = false;
          this.selectedTarget = '';
          this.selectedEmergencyTarget = '';
          this.voteTiedMessage = '';
          void LocalNotifications.schedule({
            notifications: [{
              id: Date.now() + 1,
              title: 'Fase de votación',
              body: 'La auditoría ha terminado. Elige a quién expulsar de la red.',
            }]
          });
        }
        if (t.to === 'VERIFICACION' && !amDead) {
          this.setStatus('Verificando integridad del sistema…', 'info');
        }
        this.voteUrgentSeconds = 0;
      }),
    );

    this.subs.add(
      this.socketService.incidentReport$.subscribe((report) => {
        const ids = getEliminatedIdsFromIncident(report);
        if (!ids.length) return;

        this.incidentNames = ids
          .map((id) => this.players.find((p) => p.id === id)?.name ?? id)
          .filter(Boolean);
        this.queueNodeDeathAlerts(ids, 'night_kill');
        
        // Retrasar el reporte de incidentes para que no bloquee el "NodeDeathAlert"
        // NodeDeathAlert = 1600ms + 4200ms = 5800ms
        clearTimeout(this.incidentTimer);
        this.incidentTimer = setTimeout(() => {
          this.showIncidentReport = true;
          this.incidentTimer = setTimeout(() => {
            this.showIncidentReport = false;
          }, 8000);
        }, 5800);
      }),
    );

    this.subs.add(
      this.socketService.nightResolved$.subscribe(({ resolution }) => {
        const kills = resolution.kills?.length ?? 0;
        const silenced = resolution.silenced?.length ?? 0;
        const parts: string[] = [];
        if (kills) parts.push(`${kills} caída(s) nocturna(s)`);
        if (silenced) parts.push(`${silenced} silenciado(s)`);
        if (resolution.infections?.length) parts.push(`${resolution.infections.length} infectado(s)`);
        if (resolution.cures?.length) parts.push(`${resolution.cures.length} curado(s)`);
        if (parts.length) {
          this.setStatus(`Noche resuelta: ${parts.join(', ')}`, 'warn');
        }

        if (this.pendingNightAction && this.nightActionReport?.status === 'pending') {
          this.nightActionReport = buildResolvedReport(
            this.pendingNightAction,
            resolution,
            this.myPlayerId,
            this.players,
          );
          this.pushNightHistory(this.nightActionReport);
          this.pendingNightAction = null;
        }

        if (resolution.infectionKills?.includes(this.myPlayerId)) {
          this.myDeathReason = 'infection';
          this.setStatus(
            `Tu nodo cayó por infección de ${infectionSourceLabel(this.myInfectionSource ?? 'worm')}`,
            'error',
          );
          this.myInfectionMaturesAfterNight = null;
          this.myInfectionSource = null;
        } else if (resolution.cures?.includes(this.myPlayerId)) {
          this.setStatus('Un Antivirus curó tu infección', 'success');
          this.myInfectionMaturesAfterNight = null;
          this.myInfectionSource = null;
          this.nightActionReport = null;
        }
      }),
    );

    this.subs.add(
      this.socketService.voteTied$.subscribe((payload) => {
        const candidateNames = payload.candidates.map(
          (id) => this.players.find((p) => p.id === id)?.name ?? id,
        );
        this.voteTiedMessage = formatVoteTiedMessage({
          reason: payload.reason,
          candidates: candidateNames,
          skipVotes: payload.skipVotes ?? 0,
        });
        this.gameSound.play('vote_tie');
      }),
    );

    this.subs.add(
      this.socketService.voteTrace$.subscribe((trace) => {
        if (trace.voter === this.myPlayerId) {
          this.myVoteConfirmed = true;
          const targetLabel = trace.target
            ? (this.players.find((p) => p.id === trace.target)?.name ?? trace.target)
            : 'abstención';
          this.setStatus(`Voto registrado: ${targetLabel}`, 'success');
        }
      }),
    );

    this.subs.add(
      this.socketService.playerEliminated$.subscribe(({ playerId, reason }) => {
        const name = this.players.find((p) => p.id === playerId)?.name ?? playerId;
        const reasonLabel = translateEliminationReason(reason);
        if (playerId === this.myPlayerId && !this.showGameOver) {
          this.myDeathReason = reason;
          this.setStatus(`Eliminado por ${reasonLabel}`, 'error');
          this.transitionToEliminated();
          this.showLastWillPrompt();
        } else {
          this.queueNodeDeathAlerts([playerId], reason);
        }
      }),
    );

    this.subs.add(
      this.socketService.playerDisconnected$.subscribe(({ playerId, playerName }) => {
        const name = playerName ?? this.players.find((p) => p.id === playerId)?.name ?? playerId;
        this.setStatus(`Nodo desconectado: ${name}`, 'warn');
      }),
    );

    this.subs.add(
      this.socketService.playerConnected$.subscribe(({ playerId, playerName }) => {
        const name = playerName ?? this.players.find((p) => p.id === playerId)?.name ?? playerId;
        this.setStatus(`${name} conectado [OK]`, 'success');
        if (this.gamePhase === 'LOBBY') {
          this.gameSound.playAccepted();
          void this.hapticService.playConfirm();
        }
      }),
    );

    this.subs.add(
      this.socketService.playerReconnected$.subscribe(({ playerId, playerName }) => {
        const name = playerName ?? this.players.find((p) => p.id === playerId)?.name ?? playerId;
        this.setStatus(`${name} reconectado [OK]`, 'success');
        if (this.gamePhase === 'LOBBY') {
          this.gameSound.playAccepted();
          void this.hapticService.playConfirm();
        }
      }),
    );

    this.subs.add(
      this.socketService.minigameChallenge$.subscribe((c) => {
        this.minigameChallenge = c;
        this.minigamePending = false;
        this.minigameFeedbackType = 'none';
        this.minigameFeedbackMessage = '';
      }),
    );

    this.subs.add(
      this.socketService.minigameAnswerResult$.subscribe((payload) => {
        this.minigamePending = false;
        if (payload.result === 'success') {
          this.challengeAnswer = this.pendingMinigameAnswer;
          this.minigameChallenge = null;
          this.minigameFeedbackType = 'none';
          this.minigameFeedbackMessage = '';
          this.setStatus(payload.successHint ?? 'Reto superado  Eacción con precisión máxima', 'success');
          this.gameSound.playAccepted();
          return;
        }
        if (payload.result === 'failed') {
          this.minigameFeedbackType = 'error';
          this.minigameFeedbackMessage = payload.failHint ?? 'Respuesta incorrecta. Inténtalo de nuevo.';
          this.triggerInterferenceShake();
          this.setStatus(this.minigameFeedbackMessage, 'error');
          return;
        }
        if (payload.result === 'skipped' || payload.result === 'expired') {
          this.challengeAnswer = null;
          this.minigameChallenge = null;
          this.minigameFeedbackType = 'none';
          this.minigameFeedbackMessage = '';
          this.setStatus(
            payload.failHint ?? (payload.result === 'expired' ? 'Tiempo agotado  Eacción degradada' : 'Reto omitido  Eacción degradada'),
            'warn',
          );
        }
      }),
    );

    this.subs.add(
      this.socketService.nightProgress$.subscribe((p) => {
        this.nightProgress = p;
      }),
    );

    this.subs.add(
      this.socketService.chatMessage$.subscribe((m) => {
        if (!this.chatMessages.some((existing) => existing.id === m.id)) {
          this.chatMessages.push(m);
          this.gameSound.playChat();
          setTimeout(() => this.scrollToBottomIfNeeded(), 50);
        }
      }),
    );

    this.subs.add(
      this.socketService.gameStats$.subscribe((s) => {
        this.gameStats = s;
      }),
    );

    this.subs.add(
      this.socketService.actionAccepted$.subscribe(() => {
        this.gameSound.playAccepted();
        this.setStatus('Comando enviado al servidor', 'success');
        this.selectedTarget = '';
        this.selectedSecondary = '';
      }),
    );

    this.subs.add(
      this.socketService.gameOver$.subscribe(({ winner, soloWinner }) => {
        this.handleGameOver(winner, soloWinner);
      }),
    );

    this.subs.add(
      this.socketService.error$.subscribe((msg) => {
        const toast = formatServerErrorForToast(msg);
        this.setStatus(toast, 'error');
        const cooldown = parseChatCooldownSeconds(msg);
        if (cooldown) this.startChatCooldown(cooldown);
      }),
    );

    this.subs.add(
      this.socketService.lobbyClosed$.subscribe(({ roomId }) => {
        void this.handleLobbyClosed(roomId, 'host_abandoned');
      }),
    );

    this.subs.add(
      this.socketService.playerKicked$.subscribe(({ roomId }) => {
        void this.handleLobbyClosed(roomId, 'player_kicked');
      }),
    );

    this.startRoomStatusWatch();
    this.startPhaseTimer();
  }

  private startPhaseTimer(): void {
    clearInterval(this.phaseTimerInterval);
    this.phaseTimerInterval = setInterval(() => {
      const matchStart = this.resolveMatchStartedAt();
      if (matchStart && this.gamePhase !== 'LOBBY' && this.gamePhase !== 'FIN' && this.gamePhase !== 'ELIMINATED') {
        const secs = Math.floor((Date.now() - matchStart) / 1000);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        this.matchElapsed = `${m}:${s.toString().padStart(2, '0')}`;
      } else {
        this.matchElapsed = '';
      }

      if (!this.phaseStartedAt) {
        this.phaseCountdown = '';
        this.phaseRemainingSeconds = 0;
        this.voteUrgentSeconds = 0;
        return;
      }
      const endsAt = this.resolvePhaseEndsAt();
      if (!endsAt || !this.phaseConfig?.autoAdvance) {
        this.phaseCountdown = '';
        this.phaseRemainingSeconds = 0;
        this.voteUrgentSeconds = 0;
        return;
      }

      this.phaseTotalSeconds = this.resolvePhaseDurationSeconds();
      const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      this.phaseRemainingSeconds = remaining;

      const rm = Math.floor(remaining / 60);
      const rs = remaining % 60;
      this.phaseCountdown = `${rm}:${rs.toString().padStart(2, '0')}`;

      if (remaining <= 5 && remaining > 0 && this.lastHapticSecond !== remaining) {
        this.lastHapticSecond = remaining;
        void this.hapticService.playTimerTick();
      }

      if (remaining === 0 && !this.timerExpiredPlayed) {
        this.timerExpiredPlayed = true;
        this.gameSound.play('timer_warning');
      }

      if (this.gamePhase === 'VOTACION' && remaining > 0 && remaining <= 10) {
        this.voteUrgentSeconds = remaining;
      } else {
        this.voteUrgentSeconds = 0;
      }
    }, 250);
  }

  get timerState(): 'normal' | 'warning' | 'critical' | 'expired' {
    if (!this.phaseRemainingSeconds || !this.phaseTotalSeconds) return 'normal';
    if (this.phaseRemainingSeconds === 0) return 'expired';
    if (this.phaseRemainingSeconds <= 10) return 'critical';
    if (this.phaseRemainingSeconds <= this.phaseTotalSeconds * 0.4) return 'warning';
    return 'normal';
  }

  get totalVoters(): number {
    return this.players.filter((p) => p.isAlive).length;
  }

  get votesEmitted(): number {
    if (!this.lastGameState || !this.lastGameState.votes) return 0;
    let count = 0;
    for (const key of Object.keys(this.lastGameState.votes)) {
      count += this.lastGameState.votes[key].length;
    }
    return count;
  }

  get majorityThreshold(): number {
    return Math.floor(this.totalVoters / 2) + 1;
  }

  get majorityReached(): boolean {
    return this.votesEmitted >= this.majorityThreshold;
  }

  get voteProgressPercent(): number {
    if (this.totalVoters === 0) return 0;
    return Math.min(100, (this.votesEmitted / this.totalVoters) * 100);
  }

  private resolveMatchStartedAt(): number | null {
    if (this.gameStartedAt) return this.gameStartedAt;
    if (this.phaseStartedAt && this.gamePhase !== 'LOBBY') return this.phaseStartedAt;
    return null;
  }

  private resolvePhaseEndsAt(): number | null {
    if (this.phaseEndsAt) return this.phaseEndsAt;
    if (!this.phaseConfig?.autoAdvance || !this.phaseStartedAt) return null;
    let ms = 0;
    switch (this.gamePhase) {
      case 'NOCHE':
        ms = this.phaseConfig.nightDurationMs;
        break;
      case 'DIA':
        ms = this.phaseConfig.dayDurationMs;
        break;
      case 'VOTACION':
        ms = this.phaseConfig.voteDurationMs;
        break;
      case 'VERIFICACION':
        ms = 1_500;
        break;
      default:
        return null;
    }
    return ms > 0 ? this.phaseStartedAt + ms : null;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.incidentTimer);
    clearTimeout(this.flashTimer);
    clearTimeout(this.statusTimer);
    clearInterval(this.roleBriefingTimer);
    clearTimeout(this.roleBriefingHideTimer);
    clearInterval(this.threatBriefingTimer);
    clearTimeout(this.threatBriefingHideTimer);
    clearInterval(this.chatCooldownTimer);
    clearInterval(this.roomStatusTimer);
    clearInterval(this.phaseTimerInterval);
    this.clearNodeDeathAlerts();
    this.socketService.cancelGameOverRedirect();
  }

  dismissRoleBriefing(): void {
    this.finishRoleBriefing();
  }

  dismissThreatBriefing(): void {
    if (this.roomCode) {
      sessionStorage.setItem(`fp_threat_${this.roomCode}`, '1');
    }
    this.closeThreatBriefing();
  }

  /** En NOCHE el móvil no reproduce SFX de gameplay (evita meta por audio en mesa). */
  private syncNightSoundPolicy(phase: GamePhase | 'ELIMINATED'): void {
    this.gameSound.setNightSilent(phase === 'NOCHE');
  }

  /** Respaldo si el socket no recibe lobbyClosed (p. ej. reconexión o túnel inestable). */
  private startRoomStatusWatch(): void {
    clearInterval(this.roomStatusTimer);
    this.roomStatusTimer = setInterval(() => {
      void this.checkRoomStillActive();
    }, 12000);
    void this.checkRoomStillActive();
  }

  private async checkRoomStillActive(): Promise<void> {
    if (!this.roomCode || this.showGameOver || this.lobbyClosedAlertOpen) return;
    const status = await fetchRoomStatus(this.roomCode, this.myPlayerId);
    if (isRoomStatusUnavailable(status)) return;
    if (!status.exists) {
      this.socketService.exitAfterLobbyClosed(this.roomCode);
    }
  }

  private async handleLobbyClosed(
    roomId: string,
    reason: 'host_abandoned' | 'player_kicked' = 'host_abandoned',
  ): Promise<void> {
    if (this.lobbyClosedAlertOpen) return;
    this.lobbyClosedAlertOpen = true;
    clearInterval(this.roomStatusTimer);
    this.lobbyClosedRoomId = roomId.toUpperCase().trim();
    this.lobbyClosedReason = reason;
    this.showLobbyClosedOverlay = true;
  }

  onLobbyClosedDismiss(): void {
    this.showLobbyClosedOverlay = false;
    this.lobbyClosedAlertOpen = false;
    void this.router.navigate(['/login']);
  }

  openRoleGuide(): void {
    this.showRoleGuide = true;
  }

  closeRoleGuide(): void {
    this.showRoleGuide = false;
  }

  private openRoleBriefing(team: string): void {
    this.closeRoleBriefing();
    this.gameSound.playRoleReveal();
    this.showRoleBriefing = true;
    this.roleRevealTeam = team;
    this.roleBriefingProgress = 100;
    const started = Date.now();
    this.roleBriefingTimer = setInterval(() => {
      const elapsed = Date.now() - started;
      this.roleBriefingProgress = Math.max(0, 100 - (elapsed / this.roleBriefingDurationMs) * 100);
    }, 120);
    this.roleBriefingHideTimer = setTimeout(() => this.finishRoleBriefing(), this.roleBriefingDurationMs);
  }

  private finishRoleBriefing(): void {
    if (!this.showRoleBriefing) return;
    if (this.roomCode) {
      sessionStorage.setItem(`fp_role_brief_${this.roomCode}`, '1');
    }
    void this.gameSound.unlockAudio();
    this.closeRoleBriefing();
    void this.runThreatBriefingHaptic();
    if (this.sessionThreatBrief && !this.threatBriefingSeenForRoom(this.roomCode)) {
      this.openThreatBriefing();
    }
  }

  private openThreatBriefing(): void {
    if (!this.sessionThreatBrief) return;
    this.closeThreatBriefing();
    const team = this.teamTheme || 'system';
    this.threatBriefingView = buildThreatBriefingView(team, this.sessionThreatBrief);
    this.showThreatBriefing = true;
    this.gameSound.play('incident');
    this.threatBriefingProgress = 100;
    const started = Date.now();
    this.threatBriefingTimer = setInterval(() => {
      const elapsed = Date.now() - started;
      this.threatBriefingProgress = Math.max(0, 100 - (elapsed / this.threatBriefingDurationMs) * 100);
    }, 120);
    this.threatBriefingHideTimer = setTimeout(
      () => this.dismissThreatBriefing(),
      this.threatBriefingDurationMs,
    );
  }

  private closeThreatBriefing(): void {
    clearInterval(this.threatBriefingTimer);
    clearTimeout(this.threatBriefingHideTimer);
    this.showThreatBriefing = false;
    this.threatBriefingProgress = 0;
    this.threatBriefingView = null;
  }

  updateRoleList(): void {
    if (!this.sessionThreatBrief) {
      this.roleListLines = [];
      return;
    }

    const lines: string[] = [
      `${this.sessionThreatBrief.hackerCount} Black Hat${this.sessionThreatBrief.hackerCount === 1 ? '' : 's'}`,
      `${this.sessionThreatBrief.intruderCount} Caótico${this.sessionThreatBrief.intruderCount === 1 ? '' : 's'}`,
      `${this.sessionThreatBrief.systemCount} Sistema`,
    ];

    if (this.playerRole && this.playerRole !== 'Desconocido') {
      lines.push(`Tu rol: ${this.playerRole}`);
    }

    this.roleListLines = lines;
  }

  openRoleList(): void {
    this.updateRoleList();
    this.showRoleList = true;
  }

  closeRoleList(): void {
    this.showRoleList = false;
  }

  private threatBriefingSeenForRoom(roomId: string): boolean {
    return sessionStorage.getItem(`fp_threat_${roomId}`) === '1';
  }

  private async runThreatBriefingHaptic(): Promise<void> {
    await this.hapticService.playPhaseTransition();
  }

  private closeRoleBriefing(): void {
    clearInterval(this.roleBriefingTimer);
    clearTimeout(this.roleBriefingHideTimer);
    this.showRoleBriefing = false;
    this.roleBriefingProgress = 0;
  }

  private roleBriefingSeenForRoom(roomId: string): boolean {
    return sessionStorage.getItem(`fp_role_brief_${roomId}`) === '1';
  }

  isNodeCritical(player: RoomPlayer): boolean {
    return isNodeCritical(player);
  }

  getPlayerNodeBadge(player: RoomPlayer) {
    return getPlayerNodeBadge(
      this.myTeam,
      player,
      this.myPlayerId,
      this.hackerTeamMemberIds,
      this.gamePhase,
    );
  }

  deadPlayerRole(player: RoomPlayer): string | null {
    return deadPlayerRoleLabel(player, this.gamePhase);
  }

  get playersPerBlackHat(): number {
    return playersPerBlackHatForTable(this.maxPlayers);
  }

  get infectionSourceText(): string {
    return infectionSourceLabel(this.myInfectionSource ?? 'worm');
  }

  toggleTopology(): void {
    this.topologyOpen = !this.topologyOpen;
    void this.gameSound.unlockAudio();
  }

  selectControlTab(tab: 'mission' | 'intel' | 'network' | 'comms'): void {
    this.activeControlTab = tab;
    if (tab === 'comms') this.chatOpen = true;
    void this.gameSound.unlockAudio();
  }

  toggleSound(): void {
    this.soundMuted = !this.soundMuted;
    this.gameSound.setMuted(this.soundMuted);
    void this.gameSound.unlockAudio();
  }

  get showControlDock(): boolean {
    return (
      this.gamePhase !== 'LOBBY' &&
      this.gamePhase !== 'ELIMINATED' &&
      this.gamePhase !== 'FIN' &&
      !this.showGameOver
    );
  }

  get isInGamePhase(): boolean {
    return this.showControlDock;
  }

  get intelAlert(): boolean {
    return !!(
      this.nightActionReport ||
      this.showIncidentReport ||
      (this.isInfected && this.gamePhase !== 'LOBBY')
    );
  }

  get commsUnreadHint(): boolean {
    return this.visibleChatMessages.length > 0 && this.activeControlTab !== 'comms';
  }

  get isNightPhase(): boolean {
    return this.gamePhase === 'NOCHE' && this.canActAtNight && !this.isSilenced && !this.isFrozen;
  }

  get isVotePhase(): boolean {
    return this.gamePhase === 'VOTACION' && !this.isSilenced;
  }

  get needsSecondary(): boolean {
    return needsSecondaryTarget(this.playerRole);
  }

  get secondaryLabel(): string {
    return getSecondaryTargetLabel(this.playerRole);
  }

  get nightActionLabel(): string {
    const roleKey = this.socketService.getMyRole() ?? this.playerRole;
    const type = getNightActionType(roleKey, this.selectedNightActionType || undefined);
    return getNightActionLabel(roleKey, type ?? undefined);
  }

  get nightActionVariants(): { value: string; label: string }[] {
    return getNightActionVariants(this.socketService.getMyRole() ?? this.playerRole);
  }

  get phaseLabelText(): string {
    return phaseLabel(this.gamePhase);
  }

  trackByPlayerId(_: number, player: RoomPlayer): string {
    return player.id;
  }

  /** Actualiza targets sin recrear el array si los IDs no cambiaron (evita parpadeo del picker). */
  private syncTargetList(current: TargetOption[], next: TargetOption[]): TargetOption[] {
    if (
      current.length === next.length &&
      current.every((item, i) => item.id === next[i]?.id)
    ) {
      for (let i = 0; i < next.length; i++) {
        current[i].name = next[i].name;
        current[i].avatarUrl = next[i].avatarUrl;
        current[i].isConnected = next[i].isConnected;
        current[i].isAlive = next[i].isAlive;
      }
      return current;
    }
    return next;
  }

  get targetOptions(): TargetOption[] {
    const roleKey = this.socketService.getMyRole();
    return roleKey === 'Zero-Day' ? this.deadTargets : this.aliveTargets;
  }

  get secondaryOptions(): TargetOption[] {
    return this.aliveTargets.filter((p) => p.id !== this.selectedTarget);
  }

  get connectedCount(): number {
    return this.players.filter((p) => p.isConnected !== false).length;
  }

  get aliveCount(): number {
    return this.players.filter((p) => p.isAlive).length;
  }

  get isLobbyPhase(): boolean {
    return this.gamePhase === 'LOBBY';
  }

  get lobbyProgressPercent(): number {
    if (!this.maxPlayers) return 0;
    return Math.min(100, Math.round((this.players.length / this.maxPlayers) * 100));
  }

  get lobbyHasMinimum(): boolean {
    return this.players.length >= this.minPlayers;
  }

  get lobbyEmptySlotCount(): number {
    return Math.max(0, this.maxPlayers - this.players.length);
  }

  get lobbySummaryText(): string[] {
    if (!this.phaseConfig) return [];
    const texts: string[] = [];
    if (this.phaseConfig.autoAdvance) {
      const nMin = this.phaseConfig.nightDurationMs / 60_000;
      const dMin = this.phaseConfig.dayDurationMs / 60_000;
      const vMin = this.phaseConfig.voteDurationMs / 60_000;
      texts.push(`Temporizador: Noche ${nMin}m / Día ${dMin}m / Voto ${vMin}m`);
    } else {
      texts.push('Avance manual (Sin temporizador)');
    }
    texts.push(this.phaseConfig.minigamesEnabled !== false ? 'Minijuegos Nocturnos: ACTIVADOS' : 'Minijuegos Nocturnos: DESACTIVADOS');
    return texts;
  }

  onChatScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) return;
    const threshold = 20;
    this.isChatScrolledUp = (el.scrollHeight - el.scrollTop - el.clientHeight) > threshold;
    if (!this.isChatScrolledUp) {
      this.showNewMessageBadge = false;
    }
  }

  scrollToBottomIfNeeded(): void {
    if (!this.isChatScrolledUp) {
      this.scrollToBottom(true);
    } else {
      this.showNewMessageBadge = true;
    }
  }

  scrollToBottom(smooth = true): void {
    const el = document.querySelector('.chat-list');
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    this.isChatScrolledUp = false;
    this.showNewMessageBadge = false;
  }

  showLastWillPrompt() {
    this.showLastWillModal = true;
    this.lastWillSecondsLeft = 10;
    this.lastWillText = '';
    
    if (this.lastWillInterval) clearInterval(this.lastWillInterval);
    
    this.lastWillInterval = setInterval(() => {
      this.lastWillSecondsLeft--;
      if (this.lastWillSecondsLeft <= 0) {
        clearInterval(this.lastWillInterval);
        this.submitLastWill(); // Envía lo que haya escrito o cierra si está vacío
      }
    }, 1000);
  }

  submitLastWill() {
    if (this.lastWillInterval) clearInterval(this.lastWillInterval);
    this.showLastWillModal = false;
    
    const text = this.lastWillText.trim();
    if (text) {
      this.socketService.submitChat(text, 'public', 'last_will');
    }
  }

  sendReaction(text: string, targetPlayerId?: string) {
    this.socketService.submitChat(text, 'public', 'reaction', targetPlayerId);
  }

  async openTargetActionSheet(prefix: string) {
    const buttons = this.aliveTargets.map(target => ({
      text: target.name,
      handler: () => {
        this.sendReaction(`${prefix}: ${target.name}`, target.id);
      }
    }));

    buttons.push({
      text: 'Cancelar',
      role: 'cancel',
      handler: () => {}
    } as any);

    const actionSheet = await this.actionSheetCtrl.create({
      header: `Selecciona objetivo para: ${prefix}`,
      buttons
    });
    await actionSheet.present();
  }

  get showRolePanel(): boolean {
    return this.gamePhase !== 'LOBBY' && this.gamePhase !== 'REPARTO' && this.playerRole !== 'Desconocido';
  }

  get isInfected(): boolean {
    const me = this.players.find((p) => p.id === this.myPlayerId);
    return !!me?.infected;
  }

  get infectionSeverity(): 'none' | 'early' | 'critical' {
    if (!this.isInfected || this.myInfectionMaturesAfterNight == null) return 'none';
    if (this.dayNumber >= this.myInfectionMaturesAfterNight || this.nightNumber >= this.myInfectionMaturesAfterNight) return 'critical';
    return 'early';
  }

  async executeNightAction(): Promise<void> {
    const roleKey = this.socketService.getMyRole() ?? this.playerRole;
    const actionType = getNightActionType(roleKey, this.selectedNightActionType || undefined);
    if (!actionType) return;

    const limitedActions = ['pentester_kill', 'brute_force', 'backup_mark', 'intel_pulse'];
    if (limitedActions.includes(actionType)) {
      const alert = await this.alertCtrl.create({
        header: 'Confirmar acción',
        message: `¿Usar ${getNightActionLabel(roleKey, actionType)}? Esta acción tiene usos limitados. No se puede deshacer.`,
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Confirmar', handler: () => this.doExecuteNightAction(roleKey, actionType) }
        ],
        cssClass: 'terminal-alert',
      });
      await alert.present();
      return;
    }

    this.doExecuteNightAction(roleKey, actionType);
  }

  private doExecuteNightAction(roleKey: string, actionType: string): void {
    if (isTrollProvoke(roleKey, actionType) || isNoiseBurst(roleKey, actionType)) {
      const pool = isNoiseBurst(roleKey, actionType) ? WHITE_NOISE_MESSAGES : this.trollMessages;
      this.nightActionReport = buildPendingReport({
        actionType,
        role: roleKey,
        targetId: 'provoke',
        targetName: pool[this.selectedProvokeIndex],
        nightNumber: this.nightNumber,
      });
      this.socketService.submitNightAction('provoke', {
        messageIndex: this.selectedProvokeIndex,
        challengeToken: this.minigameChallenge?.token,
        challengeAnswer: this.challengeAnswer ?? undefined,
      }, actionType);
      this.gameSound.playAction();
      return;
    }

    if (isMirageCloak(roleKey, actionType)) {
      this.nightActionReport = buildPendingReport({
        actionType,
        role: roleKey,
        targetId: this.myPlayerId,
        targetName: 'Tu nodo',
        nightNumber: this.nightNumber,
      });
      this.socketService.submitNightAction(this.myPlayerId, {
        challengeToken: this.minigameChallenge?.token,
        challengeAnswer: this.challengeAnswer ?? undefined,
      }, actionType);
      this.gameSound.playAction();
      return;
    }

    if (isJamSignal(roleKey, actionType)) {
      this.nightActionReport = buildPendingReport({
        actionType,
        role: roleKey,
        targetId: this.myPlayerId,
        targetName: 'Tu nodo',
        nightNumber: this.nightNumber,
      });
      this.socketService.submitNightAction(this.myPlayerId, {
        challengeToken: this.minigameChallenge?.token,
        challengeAnswer: this.challengeAnswer ?? undefined,
      }, actionType);
      this.gameSound.playAction();
      return;
    }

    if (isIntelPulse(roleKey, actionType)) {
      this.nightActionReport = buildPendingReport({
        actionType,
        role: roleKey,
        targetId: 'intel',
        targetName: 'Panorama de red',
        nightNumber: this.nightNumber,
      });
      this.socketService.submitNightAction('intel', {
        challengeToken: this.minigameChallenge?.token,
        challengeAnswer: this.challengeAnswer ?? undefined,
      }, actionType);
      this.gameSound.playAction();
      return;
    }

    if (!this.selectedTarget) return;

    if (actionType === 'crypto_bribe' && !canCryptoBribe(this.myRoleMeta)) {
      this.setStatus('Sin escudos  Eno puedes sobornar al sistema', 'error');
      return;
    }

    const targetName =
      this.players.find((p) => p.id === this.selectedTarget)?.name ?? this.selectedTarget;
    const secondaryName = this.selectedSecondary
      ? (this.players.find((p) => p.id === this.selectedSecondary)?.name ?? this.selectedSecondary)
      : undefined;

    this.nightActionReport = buildPendingReport({
      actionType,
      role: roleKey,
      targetId: this.selectedTarget,
      targetName,
      secondaryId: this.selectedSecondary || undefined,
      secondaryName,
      nightNumber: this.nightNumber,
    });
    this.pendingNightAction = {
      actionType,
      role: roleKey,
      targetId: this.selectedTarget,
      targetName,
      secondaryId: this.selectedSecondary || undefined,
      secondaryName,
      nightNumber: this.nightNumber,
    };

    const challengeMeta = {
      challengeToken: this.minigameChallenge?.token,
      challengeAnswer: this.challengeAnswer ?? undefined,
    };

    if (this.needsSecondary) {
      if (!this.selectedSecondary) return;
      const meta =
        roleKey === 'Enrutador BGP'
          ? { swapWith: this.selectedSecondary, ...challengeMeta }
          : roleKey === 'Router del Caos'
            ? { routeTo: this.selectedSecondary, ...challengeMeta }
            : roleKey === 'Proxy MitM'
              ? { hijackTo: this.selectedSecondary, ...challengeMeta }
              : { redirectTo: this.selectedSecondary, ...challengeMeta };
      this.socketService.submitNightAction(this.selectedTarget, meta, actionType);
      this.gameSound.playAction();
      return;
    }

    this.socketService.submitNightAction(this.selectedTarget, challengeMeta, actionType);
    this.gameSound.playAction();
  }

  onChallengeAnswered(answer: string | number): void {
    if (!this.minigameChallenge || this.minigamePending) return;
    this.pendingMinigameAnswer = answer;
    this.minigamePending = true;
    this.minigameFeedbackType = 'none';
    this.minigameFeedbackMessage = '';
    this.socketService.submitMinigameAnswer(this.minigameChallenge.token, answer);
  }

  onChallengeSkipped(): void {
    if (!this.minigameChallenge || this.minigamePending) return;
    this.minigamePending = true;
    this.socketService.skipMinigame(this.minigameChallenge.token);
  }

  private triggerInterferenceShake(): void {
    if (this.interferenceTimer) clearTimeout(this.interferenceTimer);
    this.interferenceShake = true;
    this.interferenceTimer = setTimeout(() => {
      this.interferenceShake = false;
      this.interferenceTimer = undefined;
    }, 700);
  }

  private triggerDeathShake(): void {
    this.deathShake = true;
    this.showDeathFlash = true;
    setTimeout(() => {
      this.deathShake = false;
    }, 300);
    setTimeout(() => {
      this.showDeathFlash = false;
    }, 150);
  }

  private triggerMiniShake(): void {
    this.miniShake = true;
    setTimeout(() => {
      this.miniShake = false;
    }, 150);
  }

  private transitionToEliminated(): void {
    if (this.gamePhase === 'ELIMINATED' || this.deathHapticTriggered) return;
    this.phaseBulletin = phaseBulletin('ELIMINATED');
    void this.runDeathHaptic();
    setTimeout(() => {
      this.gamePhase = 'ELIMINATED';
      this.syncChatForPhase({ forceChannel: true });
    }, 550);
  }

  private get effectiveTeam(): string {
    return this.myTeam || this.socketService.getMyTeam() || '';
  }

  private syncChatForPhase(options?: { forceChannel?: boolean }): void {
    this.refreshChatChannelOptions();
    if (this.gamePhase === 'ELIMINATED') {
      if (options?.forceChannel || this.chatChannel !== 'dead') {
        this.chatChannel = 'dead';
      }
      this.chatOpen = true;
      return;
    }
    if (
      options?.forceChannel &&
      this.gamePhase === 'NOCHE' &&
      this.effectiveTeam === 'black_hat'
    ) {
      this.chatChannel = 'hacker';
      this.chatOpen = true;
      return;
    }
    if (this.effectiveTeam !== 'black_hat' && this.chatChannel === 'hacker') {
      this.chatChannel = 'public';
    }
  }

  private refreshChatChannelOptions(): void {
    if (this.gamePhase === 'ELIMINATED') {
      this.chatChannelOptions = [{ value: 'dead', label: 'Espectadores (eliminados)' }];
      return;
    }
    if (this.effectiveTeam === 'black_hat' && this.gamePhase === 'NOCHE') {
      this.chatChannelOptions = [
        { value: 'hacker', label: 'Canal hacker (noche)' },
        { value: 'public', label: 'Público' },
      ];
      return;
    }
    if (this.effectiveTeam === 'black_hat') {
      this.chatChannelOptions = [
        { value: 'public', label: 'Público' },
        { value: 'hacker', label: 'Canal hacker' },
      ];
      return;
    }
    this.chatChannelOptions = [{ value: 'public', label: 'Público' }];
  }

  private resolvePhaseDurationSeconds(): number {
    if (!this.phaseConfig) return 0;
    switch (this.gamePhase) {
      case 'NOCHE': return Math.floor(this.phaseConfig.nightDurationMs / 1000);
      case 'DIA': return Math.floor(this.phaseConfig.dayDurationMs / 1000);
      case 'VOTACION': return Math.floor(this.phaseConfig.voteDurationMs / 1000);
      default: return 0;
    }
  }

  private getEffectiveChatChannel(): 'public' | 'dead' | 'hacker' {
    if (this.gamePhase === 'ELIMINATED') return 'dead';
    return this.chatChannel;
  }

  sendChat(): void {
    const text = this.chatInput.trim();
    if (!text) return;
    if (this.chatCooldownSec > 0) {
      this.setStatus(`Chat en cooldown (${this.chatCooldownSec}s)`, 'warn');
      return;
    }
    const channel = this.getEffectiveChatChannel();
    if (this.socketService.submitChat(text, channel)) {
      this.chatInput = '';
      this.startChatCooldown(3);
    }
  }

  private startChatCooldown(seconds: number): void {
    clearInterval(this.chatCooldownTimer);
    this.chatCooldownSec = seconds;
    this.chatCooldownTimer = setInterval(() => {
      this.chatCooldownSec -= 1;
      if (this.chatCooldownSec <= 0) {
        this.chatCooldownSec = 0;
        clearInterval(this.chatCooldownTimer);
        this.chatCooldownTimer = undefined;
      }
    }, 1000);
  }

  trackChatChannel(_index: number, ch: { value: string }): string {
    return ch.value;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByVariant(_index: number, variant: { value: string; label: string }): string {
    return variant.value;
  }

  get canShowChat(): boolean {
    if (this.gamePhase === 'ELIMINATED') return false;
    if (this.gamePhase === 'LOBBY' || this.gamePhase === 'DIA' || this.gamePhase === 'VOTACION' || this.gamePhase === 'FIN') {
      return true;
    }
    if (this.gamePhase === 'NOCHE' && this.effectiveTeam === 'black_hat') return true;
    return false;
  }

  get visibleChatMessages(): ChatMessage[] {
    const channel = this.getEffectiveChatChannel();
    const filtered = this.chatMessages.filter((m) => {
      if (channel === 'dead') {
        return m.channel === 'dead';
      }
      if (m.channel === 'public') return true;
      return m.channel === channel;
    });
    return filtered.slice(-25);
  }

  private hackerTeamStorageKey(): string {
    return `fp_hacker_team_${(this.roomCode || localStorage.getItem('roomCode') || '').toUpperCase()}`;
  }

  private persistHackerTeam(members: string[]): void {
    const key = this.hackerTeamStorageKey();
    if (!key || key === 'fp_hacker_team_') return;
    try {
      sessionStorage.setItem(key, JSON.stringify(members));
    } catch {
      /* ignore quota errors */
    }
  }

  private restoreHackerTeamFromStorage(): void {
    const key = this.hackerTeamStorageKey();
    if (!key || key === 'fp_hacker_team_') return;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length) {
        this.hackerTeamMemberIds = parsed;
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  exitRoomCompletely(): void {
    void this.confirmLeave();
  }

  get nightActionDisabled(): boolean {
    const roleKey = this.socketService.getMyRole() ?? this.playerRole;
    const actionType = getNightActionType(roleKey, this.selectedNightActionType || undefined) ?? undefined;
    if (isTrollProvoke(roleKey, actionType) || isNoiseBurst(roleKey, actionType)) return false;
    if (isMirageCloak(roleKey, actionType) || isJamSignal(roleKey, actionType) || isIntelPulse(roleKey, actionType)) {
      return false;
    }
    if (!this.selectedTarget) return true;
    if (this.needsSecondary && !this.selectedSecondary) return true;
    if (actionType === 'crypto_bribe' && !canCryptoBribe(this.myRoleMeta)) return true;
    return false;
  }

  executeEmergencyPatch(): void {
    if (!this.selectedEmergencyTarget) return;
    this.showPatchConfirm = true;
  }

  confirmEmergencyPatch(): void {
    if (!this.selectedEmergencyTarget) return;
    if (this.socketService.submitDayAction('emergency_patch', this.selectedEmergencyTarget)) {
      this.showPatchConfirm = false;
      this.setStatus('Parche de emergencia aplicado', 'success');
      this.gameSound.playAction();
    }
  }

  cancelEmergencyPatch(): void {
    this.showPatchConfirm = false;
  }

  private pushNightHistory(report: NightActionReport): void {
    const key = `${report.nightNumber}:${report.headline}`;
    if (this.nightHistory.some((r) => `${r.nightNumber}:${r.headline}` === key)) return;
    this.nightHistory = [report, ...this.nightHistory].slice(0, 3);
  }

  private async runScanHaptic(result?: string): Promise<void> {
    if (result === 'malicious') {
      await this.hapticService.playScanMalicious();
      this.gameSound.play('scan_malicious');
    } else if (result === 'suspicious') {
      await this.hapticService.playError();
    } else {
      await this.hapticService.playScanSafe();
      this.gameSound.play('scan_safe');
    }
  }

  executeVote(): void {
    if (!this.selectedTarget || this.voteCeremonyActive) return;
    this.voteCeremonyActive = true;
    this.gameSound.playVote();
    void this.hapticService.playVoteConfirmed();
    
    setTimeout(() => {
      this.socketService.submitVote(this.selectedTarget);
      this.voteCeremonyActive = false;
    }, 500);
  }

  executeSkipVote(): void {
    this.socketService.submitVote(null);
    this.selectedTarget = '';
  }

  returnToLogin(): void {
    this.socketService.cancelGameOverRedirect();
    this.socketService.finalizeAfterGameOver();
    void this.router.navigate(['/login'], { queryParams: { finished: '1' } });
  }

  private setPersistentRoleInfo(headline: string, details: string[]): void {
    this.nightActionReport = {
      nightNumber: this.nightNumber,
      status: 'resolved',
      headline,
      details,
    };
  }

  private syncInfectionFromState(me: RoomPlayer | undefined): void {
    if (!me?.infected) {
      this.myInfectionMaturesAfterNight = null;
      this.myInfectionSource = null;
      return;
    }
    this.myInfectionMaturesAfterNight = me.infectionMaturesAfterNight ?? null;
    if (!this.myInfectionSource) {
      this.myInfectionSource = 'worm';
    }
    if (
      !this.nightActionReport ||
      !this.nightActionReport.headline.toLowerCase().includes('infect')
    ) {
      this.nightActionReport = {
        nightNumber: this.nightNumber,
        status: 'resolved',
        headline: '☣ Infección activa',
        details: [
          `Fuente: ${infectionSourceLabel(this.myInfectionSource)}`,
          this.myInfectionMaturesAfterNight != null
            ? `Madura tras resolver la noche N${this.myInfectionMaturesAfterNight} sin cura.`
            : 'Un Antivirus puede curarte de noche.',
        ],
      };
    }
  }

  private syncRoleMeta(me: RoomPlayer | undefined): void {
    this.myRoleMeta = me?.meta;
    const roleKey = this.socketService.getMyRole() ?? me?.role;
    this.roleStatusLines = getRoleStatusLines(roleKey, this.myRoleMeta, this.players.length);
  }

  private setStatus(msg: string, type: 'info' | 'success' | 'error' | 'warn'): void {
    this.statusMessage = msg;
    this.statusType = type;
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => {
      if (this.statusMessage === msg) this.statusMessage = '';
    }, 6000);
  }

  private triggerPhaseFlash(phase: GamePhase): void {
    this.phaseFlash = phase;
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.phaseFlash = '';
    }, 2000);
  }

  private handleGameOver(
    winner: string | null | undefined,
    soloWinner?: { playerId: string; role: string; reason: string } | null,
  ): void {
    this.showGameOverScreen(winner, soloWinner);
  }

  private async runPhaseHaptic(phase: GamePhase): Promise<void> {
    if (phase === 'NOCHE') {
      await this.hapticService.playPhaseTransition();
    } else if (phase === 'DIA') {
      await this.hapticService.playConfirm();
    }
  }

  private async runDeathHaptic(): Promise<void> {
    if (this.deathHapticTriggered) return;
    this.deathHapticTriggered = true;
    this.triggerDeathShake();
    this.gameSound.playDeath();
    await this.hapticService.playDeath();
  }

  private queueNodeDeathAlerts(playerIds: string[], reason: string): void {
    const others = playerIds.filter((id) => id !== this.myPlayerId);
    const playersData = others.map((id) => {
      const p = this.players.find((x) => x.id === id);
      return { name: p?.name ?? id, role: p?.role };
    });
    if (others.length > 0) {
      this.triggerMiniShake();
    }
    const alert = buildNodeDeathAlert(playersData, reason);
    if (!alert) return;
    this.deathAlertQueue.push(alert);
    this.pumpNodeDeathAlertQueue();
  }

  private pumpNodeDeathAlertQueue(): void {
    if (this.showNodeDeathAlert || !this.deathAlertQueue.length) return;

    if (this.deathAlertTimer) clearTimeout(this.deathAlertTimer);
    if (this.deathAlertExitTimer) clearTimeout(this.deathAlertExitTimer);

    this.nodeDeathAlert = this.deathAlertQueue.shift() ?? null;
    if (!this.nodeDeathAlert) return;

    this.nodeDeathAlertExiting = false;
    
    // Retraso de 1600ms para mantener sincronía con el dashboard web y 
    // permitir que las animaciones visuales ocurran primero en la pantalla grande
    setTimeout(() => {
      this.showNodeDeathAlert = true;
      this.gameSound.playDeath();
      void this.runNodeDisconnectHaptic();

      this.deathAlertTimer = setTimeout(() => {
        this.nodeDeathAlertExiting = true;
        this.deathAlertExitTimer = setTimeout(() => {
          this.showNodeDeathAlert = false;
          this.nodeDeathAlert = null;
          this.nodeDeathAlertExiting = false;
          this.deathAlertTimer = undefined;
          this.deathAlertExitTimer = undefined;
          this.pumpNodeDeathAlertQueue();
        }, 420);
      }, DashboardPage.DEATH_ALERT_MS);
    }, 1600);
  }

  private clearNodeDeathAlerts(): void {
    this.deathAlertQueue = [];
    if (this.deathAlertTimer) clearTimeout(this.deathAlertTimer);
    if (this.deathAlertExitTimer) clearTimeout(this.deathAlertExitTimer);
    this.deathAlertTimer = undefined;
    this.deathAlertExitTimer = undefined;
    this.showNodeDeathAlert = false;
    this.nodeDeathAlertExiting = false;
    this.nodeDeathAlert = null;
  }

  private async runNodeDisconnectHaptic(): Promise<void> {
    await this.hapticService.playConnectionError();
  }

  private showGameOverScreen(
    winner: string | null | undefined,
    soloWinner?: { playerId: string; role: string; reason: string } | null,
  ): void {
    this.showGameOver = true;
    this.gamePhase = 'FIN';
    this.gameOverStep = 0;
    
    // Stagger the game over reveal
    setTimeout(() => this.gameOverStep = 1, 2000);
    setTimeout(() => this.gameOverStep = 2, 4000);

    this.gameOverView = buildGameOverView(
      this.myTeam || this.socketService.getMyTeam(),
      this.myPlayerId,
      winner,
      soloWinner,
      this.players,
    );

    if (this.gameOverView.didWin) {
      this.hapticService.playVictory();
      if (soloWinner) {
        this.gameSound.play('game_over_solo');
      } else if (winner === 'black_hat') {
        this.gameSound.play('game_over_hacker');
      } else {
        this.gameSound.play('game_over_system');
      }
    } else {
      this.hapticService.playDefeat();
      this.gameSound.play('defeat');
    }

    if (this.lastGameState) {
      const user = this.authService.getUser();
      const currentAchievements = user?.achievements || [];
      const team = this.myTeam || this.socketService.getMyTeam();
      const newUnlocks = evaluateEndOfGameAchievements(
        this.gameOverView,
        this.lastGameState,
        this.myPlayerId,
        currentAchievements,
        team
      );

      for (const id of newUnlocks) {
        this.authService.unlockAchievement(id).catch(err => 
          console.error('Failed to unlock achievement', id, err)
        );
      }
    }
  }

  get isTrollNight(): boolean {
    const roleKey = this.socketService.getMyRole() ?? this.playerRole;
    return isTrollProvoke(roleKey, this.selectedNightActionType) || isNoiseBurst(roleKey, this.selectedNightActionType);
  }

  get canEmergencyPatch(): boolean {
    return canUseEmergencyPatch(this.socketService.getMyRole(), this.myRoleMeta);
  }

  get showMinerShieldBar(): boolean {
    const roleKey = this.socketService.getMyRole() ?? this.playerRole;
    return isMinerRole(roleKey) && this.myRoleMeta?.shieldCharges != null;
  }

  get minerShieldCharges(): number {
    return this.myRoleMeta?.shieldCharges ?? 0;
  }

  get teamTheme(): 'system' | 'black_hat' | 'chaotic' | null {
    if (this.myTeam === 'system' || this.myTeam === 'black_hat' || this.myTeam === 'chaotic') {
      return this.myTeam;
    }
    return null;
  }

  /** Equipo Sistema sin acciones nocturnas: pantalla en gris durante NOCHE. */
  get isSystemNightStandby(): boolean {
    return this.myTeam === 'system' && this.gamePhase === 'NOCHE';
  }

  /** Jugador eliminado: fondo de alerta roja (no durante overlay de victoria). */
  get isPlayerDead(): boolean {
    return this.gamePhase === 'ELIMINATED' && !this.showGameOver;
  }

  get amIReady(): boolean {
    const me = this.players.find(p => p.id === this.myPlayerId);
    return me?.isReady ?? false;
  }

  toggleReady(): void {
    if (this.gamePhase !== 'LOBBY') return;
    this.hapticService.playTap();
    this.gameSound.play('ui_click');
    const newState = !this.amIReady;
    this.socketService.setPlayerReady(this.myPlayerId, newState);
  }
}

