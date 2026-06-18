import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import {
  GamePhase,
  SocketService,
  TargetOption,
} from '../../services/socket/socket.service';
import { getNightActionType } from '../../core/role-actions';
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
  gamePhase: GamePhase | 'ELIMINATED' = 'LOBBY';
  aliveTargets: TargetOption[] = [];
  deadTargets: TargetOption[] = [];
  selectedTarget = '';
  statusMessage = '';
  canActAtNight = false;

  private subs = new Subscription();
  private myPlayerId = localStorage.getItem('myPlayerId') ?? '';

  constructor(private socketService: SocketService) {}

  ngOnInit(): void {
    this.subs.add(
      this.socketService.gameState$.subscribe((state) => {
        if (state.phase) {
          this.gamePhase = state.phase;
        }

        const players = state.players ?? [];
        const me = players.find((p: any) => p.id === this.myPlayerId);

        if (me && !me.isAlive) {
          this.gamePhase = 'ELIMINATED';
        }

        this.aliveTargets = players
          .filter((p: any) => p.isAlive && p.id !== this.myPlayerId)
          .map((p: any) => ({ id: p.id, name: p.name }));

        this.deadTargets = players
          .filter((p: any) => !p.isAlive)
          .map((p: any) => ({ id: p.id, name: p.name }));
      }),
    );

    this.subs.add(
      this.socketService.playerState$.subscribe((player) => {
        if (player.name) this.playerName = player.name;
        if (player.role) {
          this.playerRole = player.role;
          this.canActAtNight = !!getNightActionType(player.role);
        }
        if (player.isDead) this.gamePhase = 'ELIMINATED';
      }),
    );

    this.subs.add(
      this.socketService.privateResult$.subscribe((payload) => {
        if (payload.type === 'scan') {
          this.statusMessage = `Escaneo: ${payload.result === 'malicious' ? 'MALICIOSO' : 'SEGURO'}`;
        }
        if (payload.type === 'hacker_team') {
          this.statusMessage = `Equipo hacker: ${(payload.members ?? []).length} nodos`;
        }
      }),
    );

    this.subs.add(
      this.socketService.actionAccepted$.subscribe(() => {
        this.statusMessage = 'Comando enviado al servidor';
        this.selectedTarget = '';
      }),
    );

    this.subs.add(
      this.socketService.error$.subscribe((msg) => {
        this.statusMessage = msg;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get isNightPhase(): boolean {
    return this.gamePhase === 'NOCHE' && this.canActAtNight;
  }

  get isVotePhase(): boolean {
    return this.gamePhase === 'VOTACION';
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

  get targetOptions(): TargetOption[] {
    return this.playerRole === 'Zero-Day' ? this.deadTargets : this.aliveTargets;
  }

  executeNightAction(): void {
    if (!this.selectedTarget) return;
    this.socketService.submitNightAction(this.selectedTarget);
  }

  executeVote(): void {
    if (!this.selectedTarget) return;
    this.socketService.submitVote(this.selectedTarget);
    this.selectedTarget = '';
    this.statusMessage = 'Voto registrado';
  }
}
