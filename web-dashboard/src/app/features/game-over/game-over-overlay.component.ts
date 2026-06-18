import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameOverSummary } from '../../core/models/game-state.model';

@Component({
  selector: 'app-game-over-overlay',
  standalone: true,
  templateUrl: './game-over-overlay.component.html',
  styleUrl: './game-over-overlay.component.scss',
})
export class GameOverOverlayComponent {
  @Input() summary: GameOverSummary | null = null;
  @Input() visible = false;

  @Output() exitRoom = new EventEmitter<void>();

  onExitRoom(): void {
    this.exitRoom.emit();
  }
}
