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
  displayedProtocolText = '';
  private timers: any[] = [];
  private scrambleTimer?: any;

  ngOnInit() {
    this.currentStep = 0;
    this.startTextScramble();
    this.timers.push(setTimeout(() => this.currentStep = 1, 3500));
    this.timers.push(setTimeout(() => this.currentStep = 2, 5000));
    this.timers.push(setTimeout(() => this.currentStep = 3, 8000));
    this.timers.push(setTimeout(() => this.currentStep = 4, 10000));
  }

  ngOnDestroy() {
    this.timers.forEach(t => clearTimeout(t));
    if (this.scrambleTimer) clearInterval(this.scrambleTimer);
  }

  private startTextScramble(): void {
    const target = this.protocolText;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*01';
    let frame = 0;
    const totalFrames = target.length * 2 + 5;
    if (this.scrambleTimer) clearInterval(this.scrambleTimer);
    this.scrambleTimer = setInterval(() => {
      let result = '';
      const revealIndex = Math.floor(frame / 2);
      for (let i = 0; i < target.length; i++) {
        if (target[i] === ' ') {
          result += ' ';
        } else if (i < revealIndex) {
          result += target[i];
        } else if (i < revealIndex + 4) {
          result += chars[Math.floor(Math.random() * chars.length)];
        } else {
          result += '_';
        }
      }
      this.displayedProtocolText = result;
      if (frame >= totalFrames) {
        this.displayedProtocolText = target;
        clearInterval(this.scrambleTimer);
      }
      frame++;
    }, 35);
  }

  get protocolText(): string {
    switch (this.summary.outcome) {
      case 'win': return 'AMENAZA NEUTRALIZADA';
      case 'loss': return 'SISTEMA COMPROMETIDO';
      default: return 'PROTOCOLO FINALIZADO';
    }
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
