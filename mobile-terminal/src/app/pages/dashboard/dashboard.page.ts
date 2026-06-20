import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  GamePhase,
  RoomPlayer,
  TargetOption,
} from '../../core/models/game-state.model';
import {
  SocketService,
} from '../../services/socket/socket.service';
import {
  getNightActionLabel,
  getNightActionType,
  getNightActionVariants,
  getRoleStatusLines,
  needsSecondaryTarget,
  getSecondaryTargetLabel,
  isTrollProvoke,
  isMinerRole,
  canUseEmergencyPatch,
  canCryptoBribe,
  TROLL_PROVOKE_MESSAGES,
} from '../../core/role-actions';
import { GameSoundService } from '../../services/game-sound.service';
import { ActionProgressComponent } from '../../components/action-progress/action-progress.component';
import { TextChallengeComponent } from '../../components/text-challenge/text-challenge.component';
import { LobbyClosedOverlayComponent } from '../../components/lobby-closed-overlay/lobby-closed-overlay.component';
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
  phaseLabel,
  translateEliminationReason,
} from '../../core/utils/game.utils';
import { formatServerErrorForToast, parseChatCooldownSeconds } from '../../core/utils/error.utils';
import { fetchRoomStatus, isRoomStatusUnavailable } from '../../core/utils/room-status.utils';
import { playersPerBlackHatForTable } from '../../core/utils/room-code.utils';
import { phaseBulletin } from '../../core/utils/phase-bulletin.utils';
import { buildGameOverView, GameOverView } from '../../core/utils/game-over.utils';
import {
  buildPendingReport,
  buildPrivateResultReport,
  buildResolvedReport,
  NightActionReport,
  PendingNightAction,
} from '../../core/utils/night-result.utils';
import { getPlayerNodeBadge } from '../../core/utils/player-visibility.utils';
import { MIN_PLAYERS_TO_START, MAX_PLAYERS, PLAYERS_PER_CHAOTIC_ROLE, PlayerRoleMeta } from '../../core/models/game-state.model';
import { Subscription } from 'rxjs';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule, ActionProgressComponent, TextChallengeComponent, LobbyClosedOverlayComponent],
})
export class DashboardPage implements OnInit, OnDestroy {
  readonly minPlayers = MIN_PLAYERS_TO_START;
  readonly playersPerChaotic = PLAYERS_PER_CHAOTIC_ROLE;
  maxPlayers = MAX_PLAYERS;
  myInfectionMaturesAfterNight: number | null = null;
  myInfectionSource: string | null = null;
  myRoleMeta: PlayerRoleMeta | undefined;
  roleStatusLines: string[] = [];
  voteTiedMessage = '';
  lastNightKillNames: string[] = [];
  topologyOpen = true;
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
  roleRevealTeam = '';
  roleVictoryHint = '';
  roleBriefingProgress = 100;
  phaseBulletin = '';
  nightProgress: NightProgress | null = null;
  minigameChallenge: MinigameChallenge | null = null;
  challengeAnswer: string | number | null = null;
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  chatOpen = false;
  chatChannel: 'public' | 'dead' | 'hacker' = 'public';
  selectedProvokeIndex = 0;
  gameStats: GameStatsEntry[] = [];
  showLobbyClosedOverlay = false;
  lobbyClosedRoomId = '';
  readonly trollMessages = TROLL_PROVOKE_MESSAGES;
  readonly canCryptoBribe = canCryptoBribe;

  private subs = new Subscription();
  private pendingNightAction: PendingNightAction | null = null;
  myPlayerId = localStorage.getItem('myPlayerId') ?? '';
  private incidentTimer?: ReturnType<typeof setTimeout>;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private statusTimer?: ReturnType<typeof setTimeout>;
  private roleBriefingTimer?: ReturnType<typeof setInterval>;
  private roleBriefingHideTimer?: ReturnType<typeof setTimeout>;
  private chatCooldownTimer?: ReturnType<typeof setInterval>;
  private roomStatusTimer?: ReturnType<typeof setInterval>;
  private lobbyClosedAlertOpen = false;
  private deathHapticTriggered = false;
  private readonly roleBriefingDurationMs = 14000;

  constructor(
    private socketService: SocketService,
    private router: Router,
    private gameSound: GameSoundService,
  ) {}

  ngOnInit(): void {
    this.roomCode = localStorage.getItem('roomCode') ?? '';

    if (!this.socketService.reconnectFromStorage()) {
      this.router.navigate(['/login']);
      return;
    }

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
        if (state.roomId) this.roomCode = state.roomId;
        this.dayNumber = state.dayNumber ?? 0;
        this.nightNumber = state.nightNumber ?? 0;
        this.maxPlayers = state.maxPlayers ?? MAX_PLAYERS;

        this.players = state.players ?? [];
        const me = this.players.find((p) => p.id === this.myPlayerId);

        const gameEnded = state.phase === 'FIN' || !!state.winner || !!state.soloWinner;

        if (gameEnded) {
          this.handleGameOver(state.winner, state.soloWinner);
        } else if (me && !me.isAlive) {
          this.gamePhase = 'ELIMINATED';
          this.phaseBulletin = phaseBulletin('ELIMINATED');
          void this.runDeathHaptic();
        } else if (state.phase) {
          this.gamePhase = state.phase;
          this.phaseBulletin = phaseBulletin(state.phase);
          this.syncNightSoundPolicy(state.phase);
        }

        this.allPlayers = this.players.map((p) => ({
          id: p.id,
          name: p.name,
          isAlive: p.isAlive,
          isConnected: p.isConnected,
        }));

        this.aliveTargets = this.players
          .filter((p) => p.isAlive && p.id !== this.myPlayerId)
          .map((p) => ({ id: p.id, name: p.name, isAlive: true, isConnected: p.isConnected }));

        this.deadTargets = this.players
          .filter((p) => !p.isAlive)
          .map((p) => ({ id: p.id, name: p.name, isAlive: false }));

        this.syncInfectionFromState(me);
        this.syncRoleMeta(me);

        if (state.nightProgress) this.nightProgress = state.nightProgress;
        if (state.chatMessages) this.chatMessages = state.chatMessages;
        if (state.gameStats) this.gameStats = state.gameStats;

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
          this.canActAtNight = !!getNightActionType(roleKey);
          const variants = getNightActionVariants(roleKey);
          if (variants.length && !this.selectedNightActionType) {
            this.selectedNightActionType = variants[0].value;
          }
        }
        if (player.teamLabel) this.playerTeamLabel = player.teamLabel;
        if (player.team) this.myTeam = player.team;
        if (player.roleDescription) this.roleDescription = player.roleDescription;
        if (player.nightActionHint) this.nightActionHint = player.nightActionHint;
        if (player.isDead && !this.showGameOver && this.gamePhase !== 'FIN') {
          this.gamePhase = 'ELIMINATED';
          void this.runDeathHaptic();
        }
        this.isSilenced = !!player.silenced;
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
          if (payload.description) this.roleDescription = payload.description;
          if (payload.nightActionHint) this.nightActionHint = payload.nightActionHint;
          if (payload.teamLabel) this.playerTeamLabel = payload.teamLabel;
          if (payload.displayName) this.playerRole = payload.displayName;
          this.roleVictoryHint = payload.victoryHint ?? '';
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
        }
        if (payload.type === 'infection_warning') {
          this.myInfectionSource = payload.infectionSource ?? 'worm';
          this.setStatus(
            payload.critical
              ? '☣ Infección crítica — caerás al amanecer si no te curaron'
              : `☣ Infectado por ${infectionSourceLabel(payload.infectionSource)} — busca Antivirus`,
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
        this.triggerPhaseFlash(t.to);
        void this.runPhaseHaptic(t.to);
        this.phaseBulletin = phaseBulletin(t.to);
        this.syncNightSoundPolicy(t.to);
        if (t.to === 'DIA') this.gameSound.playDay();
        if (t.to === 'NOCHE') {
          this.minigameChallenge = null;
          this.challengeAnswer = null;
          if (this.canActAtNight) this.socketService.requestMinigame();
        }
        if (t.to === 'DIA') {
          this.setStatus('Amanecer — auditoría diurna iniciada', 'info');
        }
        if (t.to === 'NOCHE') {
          this.setStatus('Modo sigilo activado', 'warn');
          this.topologyOpen = false;
          this.selectedTarget = '';
          this.selectedSecondary = '';
          if (!this.isInfected) {
            this.nightActionReport = null;
          }
        }
        if (t.to === 'DIA') {
          this.topologyOpen = true;
        }
        if (t.to === 'VOTACION') {
          this.myVoteConfirmed = false;
          this.selectedTarget = '';
          this.voteTiedMessage = '';
        }
        if (t.to === 'VERIFICACION') {
          this.setStatus('Verificando integridad del sistema…', 'info');
        }
      }),
    );

    this.subs.add(
      this.socketService.incidentReport$.subscribe((report) => {
        const ids = getEliminatedIdsFromIncident(report);
        if (!ids.length) return;

        this.incidentNames = ids
          .map((id) => this.players.find((p) => p.id === id)?.name ?? id)
          .filter(Boolean);
        this.showIncidentReport = true;
        clearTimeout(this.incidentTimer);
        this.incidentTimer = setTimeout(() => {
          this.showIncidentReport = false;
        }, 8000);
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
        this.setStatus(this.voteTiedMessage, 'warn');
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
          this.gamePhase = 'ELIMINATED';
          this.setStatus(`Eliminado por ${reasonLabel}`, 'error');
        } else {
          this.setStatus(`${name} eliminado (${reasonLabel})`, 'error');
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
        this.setStatus(`Nodo conectado: ${name}`, 'success');
      }),
    );

    this.subs.add(
      this.socketService.playerReconnected$.subscribe(({ playerId, playerName }) => {
        const name = playerName ?? this.players.find((p) => p.id === playerId)?.name ?? playerId;
        this.setStatus(`Nodo reconectado: ${name}`, 'success');
      }),
    );

    this.subs.add(
      this.socketService.minigameChallenge$.subscribe((c) => {
        this.minigameChallenge = c;
      }),
    );

    this.subs.add(
      this.socketService.nightProgress$.subscribe((p) => {
        this.nightProgress = p;
      }),
    );

    this.subs.add(
      this.socketService.chatMessage$.subscribe((m) => {
        this.chatMessages = [...this.chatMessages, m].slice(-30);
        this.gameSound.playChat();
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
        void this.handleLobbyClosed(roomId);
      }),
    );

    this.startRoomStatusWatch();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.incidentTimer);
    clearTimeout(this.flashTimer);
    clearTimeout(this.statusTimer);
    clearInterval(this.roleBriefingTimer);
    clearTimeout(this.roleBriefingHideTimer);
    clearInterval(this.chatCooldownTimer);
    clearInterval(this.roomStatusTimer);
    this.socketService.cancelGameOverRedirect();
  }

  dismissRoleBriefing(): void {
    if (this.roomCode) {
      sessionStorage.setItem(`fp_role_brief_${this.roomCode}`, '1');
    }
    this.closeRoleBriefing();
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

  private async handleLobbyClosed(roomId: string): Promise<void> {
    if (this.lobbyClosedAlertOpen) return;
    this.lobbyClosedAlertOpen = true;
    clearInterval(this.roomStatusTimer);
    this.lobbyClosedRoomId = roomId.toUpperCase().trim();
    this.showLobbyClosedOverlay = true;
  }

  onLobbyClosedDismiss(): void {
    this.showLobbyClosedOverlay = false;
    this.lobbyClosedAlertOpen = false;
    void this.router.navigate(['/login']);
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
    this.roleBriefingHideTimer = setTimeout(() => this.dismissRoleBriefing(), this.roleBriefingDurationMs);
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
  }

  get isNightPhase(): boolean {
    return this.gamePhase === 'NOCHE' && this.canActAtNight && !this.isSilenced;
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

  get isInfected(): boolean {
    const me = this.players.find((p) => p.id === this.myPlayerId);
    return !!me?.infected;
  }

  executeNightAction(): void {
    const roleKey = this.socketService.getMyRole() ?? this.playerRole;
    const actionType = getNightActionType(roleKey, this.selectedNightActionType || undefined);
    if (!actionType) return;

    if (isTrollProvoke(roleKey, actionType)) {
      this.nightActionReport = buildPendingReport({
        actionType,
        role: roleKey,
        targetId: 'provoke',
        targetName: this.trollMessages[this.selectedProvokeIndex],
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

    if (!this.selectedTarget) return;

    if (actionType === 'crypto_bribe' && !canCryptoBribe(this.myRoleMeta)) {
      this.setStatus('Sin escudos — no puedes sobornar al sistema', 'error');
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
          : { redirectTo: this.selectedSecondary, ...challengeMeta };
      this.socketService.submitNightAction(this.selectedTarget, meta, actionType);
      this.gameSound.playAction();
      return;
    }

    this.socketService.submitNightAction(this.selectedTarget, challengeMeta, actionType);
    this.gameSound.playAction();
  }

  onChallengeAnswered(answer: string | number): void {
    this.challengeAnswer = answer;
    this.minigameChallenge = null;
    this.setStatus('Skill check completado', 'success');
  }

  onChallengeSkipped(): void {
    this.challengeAnswer = null;
    this.minigameChallenge = null;
    this.setStatus('Skill check omitido — acción degradada', 'warn');
  }

  sendChat(): void {
    const text = this.chatInput.trim();
    if (!text) return;
    if (this.chatCooldownSec > 0) {
      this.setStatus(`Chat en cooldown (${this.chatCooldownSec}s)`, 'warn');
      return;
    }
    const channel = this.gamePhase === 'ELIMINATED' ? 'dead' : this.chatChannel;
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

  get chatChannelOptions(): { value: 'public' | 'dead' | 'hacker'; label: string }[] {
    if (this.gamePhase === 'ELIMINATED') {
      return [{ value: 'dead', label: 'Espectadores (eliminados)' }];
    }
    if (this.myTeam === 'black_hat' && this.gamePhase === 'NOCHE') {
      return [{ value: 'hacker', label: 'Canal hacker (noche)' }];
    }
    if (this.myTeam === 'black_hat') {
      return [
        { value: 'public', label: 'Público' },
        { value: 'hacker', label: 'Canal hacker' },
      ];
    }
    return [{ value: 'public', label: 'Público' }];
  }

  get canShowChat(): boolean {
    if (this.gamePhase === 'ELIMINATED') return true;
    if (this.gamePhase === 'LOBBY' || this.gamePhase === 'DIA' || this.gamePhase === 'VOTACION' || this.gamePhase === 'FIN') {
      return true;
    }
    if (this.gamePhase === 'NOCHE' && this.myTeam === 'black_hat') return true;
    return false;
  }

  get visibleChatMessages(): ChatMessage[] {
    const channel = this.gamePhase === 'ELIMINATED' ? 'dead' : this.chatChannel;
    const filtered = this.chatMessages.filter((m) => {
      if (channel === 'dead') return m.channel === 'dead';
      if (channel === 'hacker') return m.channel === 'hacker';
      return m.channel === 'public';
    });
    return filtered.slice(-25);
  }

  exitRoomCompletely(): void {
    this.socketService.clearSession();
    void this.router.navigate(['/login']);
  }

  get nightActionDisabled(): boolean {
    if (!this.selectedTarget) return true;
    if (this.needsSecondary && !this.selectedSecondary) return true;
    const actionType = getNightActionType(
      this.socketService.getMyRole() ?? this.playerRole,
      this.selectedNightActionType || undefined,
    );
    if (actionType === 'crypto_bribe' && !canCryptoBribe(this.myRoleMeta)) return true;
    return false;
  }

  executeEmergencyPatch(): void {
    if (!this.selectedTarget) return;
    this.showPatchConfirm = true;
  }

  confirmEmergencyPatch(): void {
    if (!this.selectedTarget) return;
    if (this.socketService.submitDayAction('emergency_patch', this.selectedTarget)) {
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
    try {
      if (result === 'malicious') {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        this.gameSound.play('skill_fail');
      } else if (result === 'suspicious') {
        await Haptics.impact({ style: ImpactStyle.Medium });
      }
    } catch {
      /* sin motor háptico */
    }
  }

  executeVote(): void {
    if (!this.selectedTarget) return;
    this.socketService.submitVote(this.selectedTarget);
    this.gameSound.playVote();
  }

  executeSkipVote(): void {
    this.socketService.submitVote(null);
    this.selectedTarget = '';
  }

  returnToLogin(): void {
    this.socketService.cancelGameOverRedirect();
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
    if (this.showGameOver) return;
    this.showGameOverScreen(winner, soloWinner);
  }

  private async runPhaseHaptic(phase: GamePhase): Promise<void> {
    try {
      if (phase === 'NOCHE') {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (phase === 'DIA') {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch {
      /* Web / emulador sin motor háptico */
    }
  }

  private async runDeathHaptic(): Promise<void> {
    if (this.deathHapticTriggered) return;
    this.deathHapticTriggered = true;
    this.gameSound.playDeath();
    try {
      await Haptics.vibrate({ duration: 750 });
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      /* Web / emulador sin motor háptico */
    }
  }

  private showGameOverScreen(
    winner: string | null | undefined,
    soloWinner?: { playerId: string; role: string; reason: string } | null,
  ): void {
    this.showGameOver = true;
    this.gamePhase = 'FIN';
    this.gameOverView = buildGameOverView(
      this.myTeam,
      this.myPlayerId,
      winner,
      soloWinner,
      this.players,
    );
  }

  get isTrollNight(): boolean {
    const roleKey = this.socketService.getMyRole() ?? this.playerRole;
    return isTrollProvoke(roleKey, this.selectedNightActionType);
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
}
