import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../services/socket/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule],
})
export class DashboardPage implements OnInit, OnDestroy {
  playerName: string = 'Esperando red...';
  playerRole: string = 'Desconocido';
  gamePhase: 'LOBBY' | 'NIGHT' | 'DAY' | 'ELIMINATED' = 'LOBBY';
  alivePlayers: string[] = [];
  selectedTarget: string = '';

  private subs: Subscription = new Subscription();

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    this.subs.add(
      this.socketService.gameState$.subscribe((state) => {
        // Actualizar la fase si el backend la envía
        if (state.phase) {
          this.gamePhase = state.phase;
        }

        // Filtrar solo los jugadores vivos para el combobox de atacar
        if (state.players) {
          this.alivePlayers = state.players
            .filter((p: any) => p.isAlive)
            .map((p: any) => p.name); // Sacamos solo los nombres para la lista
        }
      }),
    );

    this.subs.add(
      this.socketService.playerState$.subscribe((player) => {
        if (player.name) this.playerName = player.name;
        if (player.role) this.playerRole = player.role;
        // Si isDead es true, activamos la pantalla de eliminado
        if (player.isDead) {
          this.gamePhase = 'ELIMINATED';
        }
      }),
    );

    // Escuchamos el estado personal (Mi rol y si sigo vivo)
    this.subs.add(
      this.socketService.playerState$.subscribe((player) => {
        if (player.name) this.playerName = player.name;
        if (player.role) this.playerRole = player.role;
        if (player.isDead) this.gamePhase = 'ELIMINATED'; // Te bloquea la pantalla
      }),
    );
  }

  ngOnDestroy() {
    // Limpiamos la memoria al salir de la pantalla
    this.subs.unsubscribe();
  }

  executeAction() {
    if (this.selectedTarget) {
      this.socketService.emitAction('player-action', {
        target: this.selectedTarget,
      });
      this.selectedTarget = '';
    }
  }
}
