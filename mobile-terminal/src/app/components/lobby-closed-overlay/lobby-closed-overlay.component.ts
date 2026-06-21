import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lobby-closed-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lobby-closed-overlay.component.html',
  styleUrls: ['./lobby-closed-overlay.component.scss'],
})
export class LobbyClosedOverlayComponent {
  @Input() roomId = '';
  /** host_abandoned = sala cerrada; player_kicked = expulsado del lobby */
  @Input() reason: 'host_abandoned' | 'player_kicked' = 'host_abandoned';
  @Output() dismissed = new EventEmitter<void>();

  get title(): string {
    return this.reason === 'player_kicked' ? 'Expulsado de la sala' : 'Sala eliminada';
  }

  get message(): string {
    return this.reason === 'player_kicked'
      ? 'El host te expulsó del lobby antes de iniciar la partida.'
      : 'El host cerró esta sala desde el dashboard. La sesión ya no está disponible.';
  }

  onDismiss(): void {
    this.dismissed.emit();
  }
}
