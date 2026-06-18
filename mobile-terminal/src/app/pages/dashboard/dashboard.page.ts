import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  GamePhase,
  IncidentReport,
  RoomPlayer,
  SocketService,
  TargetOption,
} from '../../services/socket/socket.service';
import {
  getNightActionLabel,
  getNightActionType,
  needsSecondaryTarget,
  getSecondaryTargetLabel,
} from '../../core/role-actions';
import {
  isNodeCritical,
  phaseLabel,
  translateEliminationReason,
  winnerLabel,
} from '../../core/utils/game.utils';
import { MIN_PLAYERS_TO_START } from '../../core/models/game-state.model';
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
  players: RoomPlayer[] = [];

  selectedTarget = '';
  selectedSecondary = '';
  statusMessage = '';
  statusType: 'info' | 'success' | 'error' | 'warn' = 'info';
  canActAtNight = false;

  incidents: IncidentReport[] = [];
  glitchPlayerIds: string[] = [];
  showIncidentReport = false;
  phaseFlash = '';
  phaseBanner = '';
  gameOverMessage = '';
  showGameOver = false;
  myVoteConfirmed = false;

  private subs = new Subscription();
  myPlayerId = localStorage.getItem('myPlayerId') ?? '';
  private incidentTimer?: ReturnType<typeof setTimeout>;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private statusTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private socketService: SocketService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.roomCode = localStorage.getItem('roomCode') ?? '';

    this.subs.add(
      this.socketService.connected$.subscribe((c) => {
        this.connected = c;
      }),
    );

    this.subs.add(
      this.socketService.gameState$.subscribe((state) => {
        if (!state) return;

        if (state.roomId) this.roomCode = state.roomId;
        if (state.phase) this.gamePhase = state.phase;
        this.dayNumber = state.dayNumber;
        this.nightNumber = state.nightNumber;

        this.players = state.players;
        const me = this.players.find((p) => p.id === this.myPlayerId);

        if (me && !me.isAlive) {
          this.gamePhase = 'ELIMINATED';
        }

        this.aliveTargets = this.players
          .filter((p) => p.isAlive && p.id !== this.myPlayerId)
          .map((p) => ({ id: p.id, name: p.name, isAlive: true, isConnected: p.isConnected }));

        this.deadTargets = this.players
          .filter((p) => !p.isAlive)
          .map((p) => ({ id: p.id, name: p.name, isAlive: false }));

        if (state.winner || state.soloWinner) {
          this.showGameOverScreen(state.winner, state.soloWinner);
        }
      }),
    );

    this.subs.add(
      this.socketService.playerState$.subscribe((player) => {
        if (!player) return;
        if (player.name) this.playerName = player.name;
        if (player.role) {
          this.playerRole = player.role;
          this.canActAtNight = !!getNightActionType(player.roleId ?? player.role);
        }
        if (player.teamLabel) this.playerTeamLabel = player.teamLabel;
        if (player.roleDescription) this.roleDescription = player.roleDescription;
        if (player.nightActionHint) this.nightActionHint = player.nightActionHint;
        if (player.isDead) this.gamePhase = 'ELIMINATED';
        this.isSilenced = !!player.silenced;
      }),
    );

    this.subs.add(
      this.socketService.privateResult$.subscribe((payload) => {
        if (payload.type === 'scan') {
          const result = payload.result === 'malicious' ? 'MALICIOSO' : 'SEGURO';
          this.setStatus(`Escaneo completado: ${result}`, 'info');
        }
        if (payload.type === 'hacker_team') {
          const names = (payload.members ?? [])
            .map((id: string) => this.players.find((p) => p.id === id)?.name ?? id)
            .join(', ');
          this.setStatus(`Equipo Black Hat: ${names || (payload.members ?? []).length + ' nodos'}`, 'warn');
        }
        if (payload.type === 'spy') {
          const visitors = (payload.visitors ?? []).length;
          this.setStatus(`Espionaje: ${visitors} visitantes detectados`, 'info');
        }
        if (payload.type === 'role_assigned') {
          this.setStatus(`Rol asignado: ${payload.displayName ?? payload.role}`, 'success');
        }
      }),
    );

    this.subs.add(
      this.socketService.phaseChanged$.subscribe(({ phase }) => {
        this.updatePhaseBanner(phase);
      }),
    );

    this.subs.add(
      this.socketService.phaseTransition$.subscribe((t) => {
        this.triggerPhaseFlash(t.to);
        this.updatePhaseBanner(t.to);

        if (t.to === 'DIA') {
          this.setStatus('Amanecer — auditoría diurna iniciada', 'info');
        }
        if (t.to === 'NOCHE') {
          this.setStatus('Modo sigilo activado', 'warn');
          this.selectedTarget = '';
          this.selectedSecondary = '';
        }
        if (t.to === 'VOTACION') {
          this.myVoteConfirmed = false;
          this.selectedTarget = '';
        }
        if (t.to === 'VERIFICACION') {
          this.setStatus('Resolviendo votación...', 'info');
        }
      }),
    );

    this.subs.add(
      this.socketService.incidents$.subscribe((incidents) => {
        this.incidents = incidents;
        this.glitchPlayerIds = incidents.map((i) => i.playerId);
        this.showIncidentReport = true;
        clearTimeout(this.incidentTimer);
        this.incidentTimer = setTimeout(() => {
          this.showIncidentReport = false;
          this.glitchPlayerIds = [];
        }, 8000);
      }),
    );

    this.subs.add(
      this.socketService.nightResolved$.subscribe(({ resolution }) => {
        const kills = resolution.kills?.length ?? 0;
        const silenced = resolution.silenced?.length ?? 0;
        const drags = resolution.honeypotDrags?.length ?? 0;
        const parts: string[] = [];
        if (kills) parts.push(`${kills} caída(s) nocturna(s)`);
        if (silenced) parts.push(`${silenced} silenciado(s)`);
        if (drags) parts.push(`${drags} arrastre(s) honeypot`);
        if (parts.length) {
          this.setStatus(`Noche resuelta: ${parts.join(', ')}`, 'warn');
        }
      }),
    );

    this.subs.add(
      this.socketService.voteTrace$.subscribe((trace) => {
        if (trace.voter === this.myPlayerId) {
          this.myVoteConfirmed = true;
          this.setStatus('Voto registrado en el servidor', 'success');
        }
      }),
    );

    this.subs.add(
      this.socketService.voteTied$.subscribe((payload) => {
        const names = payload.candidates
          .map((id) => this.players.find((p) => p.id === id)?.name ?? id)
          .join(', ');
        this.setStatus(`Empate en votación (${payload.voteCount} votos): ${names}`, 'warn');
      }),
    );

    this.subs.add(
      this.socketService.playerEliminated$.subscribe(({ playerId, reason }) => {
        const name = this.players.find((p) => p.id === playerId)?.name ?? playerId;
        if (playerId === this.myPlayerId) {
          this.gamePhase = 'ELIMINATED';
        } else {
          this.setStatus(`${name} eliminado por ${translateEliminationReason(reason)}`, 'error');
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
        this.showGameOverScreen(winner, soloWinner);
      }),
    );

    this.subs.add(
      this.socketService.error$.subscribe((msg) => {
        this.setStatus(this.translateError(msg), 'error');
      }),
    );

    if (!this.socketService.reconnectFromStorage()) {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.incidentTimer);
    clearTimeout(this.flashTimer);
    clearTimeout(this.bannerTimer);
    clearTimeout(this.statusTimer);
  }

  isNodeCritical(player: RoomPlayer): boolean {
    return isNodeCritical(player);
  }

  isGlitching(playerId: string): boolean {
    return this.glitchPlayerIds.includes(playerId);
  }

  get isNightPhase(): boolean {
    return this.gamePhase === 'NOCHE' && this.canActAtNight && !this.isSilenced;
  }

  get isVotePhase(): boolean {
    return this.gamePhase === 'VOTACION' && !this.isSilenced;
  }

  get needsSecondary(): boolean {
    return needsSecondaryTarget(this.socketService.getMyRole());
  }

  get secondaryLabel(): string {
    return getSecondaryTargetLabel(this.socketService.getMyRole());
  }

  get nightActionLabel(): string {
    return getNightActionLabel(this.socketService.getMyRole() ?? this.playerRole);
  }

  get phaseLabelText(): string {
    return phaseLabel(this.gamePhase);
  }

  get targetOptions(): TargetOption[] {
    return this.socketService.getMyRole() === 'Zero-Day' ? this.deadTargets : this.aliveTargets;
  }

  get secondaryOptions(): TargetOption[] {
    return this.aliveTargets.filter((p) => p.id !== this.selectedTarget);
  }

  get connectedCount(): number {
    return this.players.filter((p) => p.isConnected).length;
  }

  get aliveCount(): number {
    return this.players.filter((p) => p.isAlive).length;
  }

  executeNightAction(): void {
    if (!this.selectedTarget) return;

    const role = this.socketService.getMyRole();
    if (this.needsSecondary) {
      if (!this.selectedSecondary) return;
      const meta =
        role === 'Enrutador BGP'
          ? { swapWith: this.selectedSecondary }
          : { redirectTo: this.selectedSecondary };
      this.socketService.submitNightAction(this.selectedTarget, meta);
      return;
    }

    this.socketService.submitNightAction(this.selectedTarget);
  }

  executeVote(): void {
    this.socketService.submitVote(this.selectedTarget || null);
    this.selectedTarget = '';
  }

  abstainVote(): void {
    this.socketService.submitVote(null);
    this.selectedTarget = '';
    this.setStatus('Abstención registrada', 'info');
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

  private updatePhaseBanner(phase: GamePhase): void {
    const banners: Partial<Record<GamePhase, string>> = {
      NOCHE: 'MODO SIGILO — Operaciones encubiertas',
      DIA: 'AMANECER — Auditoría de seguridad',
      VOTACION: 'VOTACIÓN EN CURSO',
    };
    this.phaseBanner = banners[phase] ?? '';
    clearTimeout(this.bannerTimer);
    if (this.phaseBanner) {
      this.bannerTimer = setTimeout(() => {
        this.phaseBanner = '';
      }, 4000);
    }
  }

  private translateError(msg: string): string {
    const labels: Record<string, string> = {
      'action rejected': 'Acción rechazada por el servidor',
      'vote rejected': 'Voto rechazado por el servidor',
      'Room not found': 'Sala no encontrada',
      'Room is full': 'La sala está llena',
    };
    return labels[msg] ?? msg;
  }

  private showGameOverScreen(
    winner: string | null | undefined,
    soloWinner?: { playerId: string; role: string; reason: string } | null,
  ): void {
    this.showGameOver = true;
    this.gamePhase = 'FIN';

    if (soloWinner) {
      const name = this.players.find((p) => p.id === soloWinner.playerId)?.name ?? soloWinner.playerId;
      this.gameOverMessage = `Victoria solitaria: ${name} (${soloWinner.role})`;
      return;
    }

    this.gameOverMessage = winnerLabel(winner);
  }
}
