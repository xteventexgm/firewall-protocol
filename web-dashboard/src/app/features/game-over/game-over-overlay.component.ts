import { LucideAngularModule } from 'lucide-angular';
import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { GameOverSummary } from '../../core/models/game-state.model';

@Component({
  selector: 'app-game-over-overlay',
  standalone: true,
  templateUrl: './game-over-overlay.component.html',
  styleUrl: './game-over-overlay.component.scss',
})
export class GameOverOverlayComponent implements OnInit, OnDestroy {
  @Input({ required: true }) summary!: GameOverSummary;
  @Input() roomId = '';
  @Input() exportingReplay = false;
  @Input() exportingSessionLog = false;

  @Output() exitRoom = new EventEmitter<void>();
  @Output() exportReplay = new EventEmitter<void>();
  @Output() exportSessionLog = new EventEmitter<void>();
  @Output() startNewGame = new EventEmitter<void>();

  currentStep = 0;
  private timers: any[] = [];

  ngOnInit() {
    this.currentStep = 0;
    this.timers.push(setTimeout(() => this.currentStep = 1, 3500));
    this.timers.push(setTimeout(() => this.currentStep = 2, 5000));
    this.timers.push(setTimeout(() => this.currentStep = 3, 8000));
    this.timers.push(setTimeout(() => this.currentStep = 4, 10000));
  }

  ngOnDestroy() {
    this.timers.forEach(t => clearTimeout(t));
  }

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
