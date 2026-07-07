import { LucideAngularModule } from 'lucide-angular';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameOverSummary } from '../../core/models/game-state.model';

@Component({
  selector: 'app-game-over-overlay',
  standalone: true,
  templateUrl: './game-over-overlay.component.html',
  styleUrl: './game-over-overlay.component.scss',
})
export class GameOverOverlayComponent {
  @Input({ required: true }) summary!: GameOverSummary;
  @Input() roomId = '';
  @Input() exportingReplay = false;
  @Input() exportingSessionLog = false;

  @Output() exitRoom = new EventEmitter<void>();
  @Output() exportReplay = new EventEmitter<void>();
  @Output() exportSessionLog = new EventEmitter<void>();
  @Output() startNewGame = new EventEmitter<void>();

  onExitRoom(): void {
    this.exitRoom.emit();
  }

  onExportReplay(): void {
    this.exportReplay.emit();
  }

  onExportSessionLog(): void {
    this.exportSessionLog.emit();
  }

  onStartNewGame(): void {
    this.startNewGame.emit();
  }
}
