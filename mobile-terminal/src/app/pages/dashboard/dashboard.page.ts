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
} from '../../core/role-actions';
import {
  deadPlayerRoleLabel,
  formatVoteTiedMessage,
  getEliminatedIdsFromIncident,
  infectionSourceLabel,
  isNodeCritical,
  phaseLabel,
  translateEliminationReason,
} from '../../core/utils/game.utils';
import { formatServerErrorForToast } from '../../core/utils/error.utils';
import { playersPerBlackHatForTable } from '../../core/utils/room-code.utils';
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

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule],
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

  private subs = new Subscription();
  private pendingNightAction: PendingNightAction | null = null;
  myPlayerId = localStorage.getItem('myPlayerId') ?? '';
  private incidentTimer?: ReturnType<typeof setTimeout>;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private statusTimer?: ReturnType<typeof setTimeout>;
  private gameOverRedirectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private socketService: SocketService,
    private router: Router,
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
        } else if (state.phase) {
          this.gamePhase = state.phase;
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
          const roleKey = payload.role ?? '';
          this.selectedNightActionType = '';
          this.canActAtNight = !!getNightActionType(roleKey);
          const variants = getNightActionVariants(roleKey);
          if (variants.length) {
            this.selectedNightActionType = variants[0].value;
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

        const report = buildPrivateResultReport(payload, this.players, this.nightNumber);
        if (report) {
          this.nightActionReport = report;
        }
      }),
    );

    this.subs.add(
      this.socketService.phaseTransition$.subscribe((t) => {
        this.triggerPhaseFlash(t.to);
        if (t.to === 'DIA') {
          this.setStatus('Amanecer — auditoría diurna iniciada', 'info');
        }
        if (t.to === 'NOCHE') {
          this.setStatus('Modo sigilo activado', 'warn');
          this.selectedTarget = '';
          this.selectedSecondary = '';
          if (!this.isInfected) {
            this.nightActionReport = null;
          }
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
      this.socketService.playerDisconnected$.subscribe(({ playerId }) => {
        const name = this.players.find((p) => p.id === playerId)?.name ?? playerId;
        this.setStatus(`Nodo desconectado: ${name}`, 'warn');
      }),
    );

    this.subs.add(
      this.socketService.playerReconnected$.subscribe(({ playerId }) => {
        const name = this.players.find((p) => p.id === playerId)?.name ?? playerId;
        this.setStatus(`Nodo reconectado: ${name}`, 'success');
      }),
    );

    this.subs.add(
      this.socketService.actionAccepted$.subscribe(() => {
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
        this.setStatus(formatServerErrorForToast(msg), 'error');
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.incidentTimer);
    clearTimeout(this.flashTimer);
    clearTimeout(this.statusTimer);
    clearTimeout(this.gameOverRedirectTimer);
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
    if (!this.selectedTarget) return;

    const roleKey = this.socketService.getMyRole() ?? this.playerRole;
    const actionType = getNightActionType(roleKey, this.selectedNightActionType || undefined);
    if (!actionType) return;

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

    if (this.needsSecondary) {
      if (!this.selectedSecondary) return;
      const meta =
        roleKey === 'Enrutador BGP'
          ? { swapWith: this.selectedSecondary }
          : { redirectTo: this.selectedSecondary };
      this.socketService.submitNightAction(this.selectedTarget, meta, actionType);
      return;
    }

    this.socketService.submitNightAction(this.selectedTarget, undefined, actionType);
  }

  executeVote(): void {
    if (!this.selectedTarget) return;
    this.socketService.submitVote(this.selectedTarget);
  }

  executeSkipVote(): void {
    this.socketService.submitVote(null);
    this.selectedTarget = '';
  }

  returnToLogin(): void {
    clearTimeout(this.gameOverRedirectTimer);
    this.navigateToLoginAfterGameOver();
  }

  private navigateToLoginAfterGameOver(): void {
    this.socketService.finalizeAfterGameOver();
    this.router.navigate(['/login'], { queryParams: { finished: '1' } });
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
    if (this.showGameOver && this.gameOverRedirectTimer) return;
    this.showGameOverScreen(winner, soloWinner);
    this.socketService.finalizeAfterGameOver();
    clearTimeout(this.gameOverRedirectTimer);
    this.gameOverRedirectTimer = setTimeout(() => {
      this.navigateToLoginAfterGameOver();
    }, 5000);
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
}
