import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  GamePhase,
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
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule],
})
export class DashboardPage implements OnInit, OnDestroy {
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

  incidentNames: string[] = [];
  showIncidentReport = false;
  phaseFlash = '';
  gameOverMessage = '';
  showGameOver = false;
  myVoteConfirmed = false;

  private subs = new Subscription();
  myPlayerId = localStorage.getItem('myPlayerId') ?? '';
  private incidentTimer?: ReturnType<typeof setTimeout>;
  private flashTimer?: ReturnType<typeof setTimeout>;
  private statusTimer?: ReturnType<typeof setTimeout>;

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
        if (state.phase) this.gamePhase = state.phase;
        if (state.dayNumber != null) this.dayNumber = state.dayNumber;
        if (state.nightNumber != null) this.nightNumber = state.nightNumber;

        this.players = state.players ?? [];
        const me = this.players.find((p) => p.id === this.myPlayerId);

        if (me && !me.isAlive) {
          this.gamePhase = 'ELIMINATED';
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

        if (state.winner || state.soloWinner) {
          this.showGameOverScreen(state.winner, state.soloWinner);
        }
      }),
    );

    this.subs.add(
      this.socketService.playerState$.subscribe((player) => {
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
          this.setStatus(`Equipo Black Hat: ${(payload.members ?? []).length} nodos`, 'warn');
        }
        if (payload.type === 'spy') {
          const visitors = (payload.visitors ?? []).length;
          this.setStatus(`Espionaje: ${visitors} visitantes detectados`, 'info');
        }
        if (payload.type === 'role_assigned') {
          this.setStatus(`Rol asignado: ${payload.role}`, 'success');
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
        }
        if (t.to === 'VOTACION') {
          this.myVoteConfirmed = false;
          this.selectedTarget = '';
        }
      }),
    );

    this.subs.add(
      this.socketService.incidentReport$.subscribe((report) => {
        const names = report.disconnected
          .map((id) => this.players.find((p) => p.id === id)?.name ?? id)
          .filter(Boolean);
        this.incidentNames = names;
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
      this.socketService.playerEliminated$.subscribe(({ playerId, reason }) => {
        const name = this.players.find((p) => p.id === playerId)?.name ?? playerId;
        if (playerId === this.myPlayerId) {
          this.gamePhase = 'ELIMINATED';
        } else {
          this.setStatus(`${name} eliminado (${reason})`, 'error');
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
        this.setStatus(msg, 'error');
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.incidentTimer);
    clearTimeout(this.flashTimer);
    clearTimeout(this.statusTimer);
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
    return getNightActionLabel(this.playerRole);
  }

  get phaseLabel(): string {
    const labels: Record<string, string> = {
      LOBBY: 'EN ESPERA',
      REPARTO: 'REPARTO DE ROLES',
      NOCHE: 'OPERACIÓN NOCTURNA',
      DIA: 'AUDITORÍA DIURNA',
      VOTACION: 'VOTACIÓN PÚBLICA',
      VERIFICACION: 'VERIFICACIÓN',
      FIN: 'PARTIDA TERMINADA',
      ELIMINATED: 'SISTEMA CAÍDO',
    };
    return labels[this.gamePhase] ?? this.gamePhase;
  }

  get teamLabel(): string {
    const teams: Record<string, string> = {
      system: 'SISTEMA',
      black_hat: 'BLACK HAT',
      chaotic: 'CAÓTICO',
    };
    return teams[this.playerTeam] ?? this.playerTeam;
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

  executeNightAction(): void {
    if (!this.selectedTarget) return;

    if (this.needsSecondary) {
      if (!this.selectedSecondary) return;
      const meta =
        this.playerRole === 'Enrutador BGP'
          ? { swapWith: this.selectedSecondary }
          : { redirectTo: this.selectedSecondary };
      this.socketService.submitNightAction(this.selectedTarget, meta);
      return;
    }

    this.socketService.submitNightAction(this.selectedTarget);
  }

  executeVote(): void {
    if (!this.selectedTarget) return;
    this.socketService.submitVote(this.selectedTarget);
    this.selectedTarget = '';
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

    const winnerLabels: Record<string, string> = {
      system: 'El SISTEMA ha restaurado la red',
      black_hat: 'BLACK HAT ha comprometido la infraestructura',
      chaotic: 'El caos ha prevalecido',
    };
    this.gameOverMessage = winner
      ? (winnerLabels[winner] ?? `Ganador: ${winner}`)
      : 'Partida terminada';
  }
}
