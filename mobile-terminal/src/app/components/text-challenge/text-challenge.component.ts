import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MinigameChallenge } from '../../core/models/game-state.model';

@Component({
  selector: 'app-text-challenge',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="challenge-panel" *ngIf="challenge">
      <header class="ch-header">
        <span class="ch-tag">SKILL CHECK</span>
        <span class="ch-timer" *ngIf="secondsLeft > 0">{{ secondsLeft }}s</span>
      </header>
      <p class="ch-prompt">{{ challenge.prompt }}</p>

      <div class="ch-options" *ngIf="challenge.options?.length">
        <button
          *ngFor="let opt of challenge.options"
          type="button"
          class="ch-option"
          [class.selected]="selectedAnswer === opt"
          (click)="selectAnswer(opt)">
          {{ opt }}
        </button>
      </div>

      <button
        type="button"
        class="terminal-btn primary ch-confirm"
        [disabled]="selectedAnswer === ''"
        (click)="confirm()">
        Confirmar respuesta
      </button>
      <button type="button" class="terminal-btn ghost ch-skip" (click)="skip.emit()">
        Omitir (acción degradada)
      </button>
    </section>
  `,
  styles: [`
    .challenge-panel {
      margin-bottom: 1rem;
      padding: 1rem;
      background: rgba(20, 0, 40, 0.5);
      border: 1px solid rgba(255, 100, 255, 0.3);
      border-radius: 4px;
    }
    .ch-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .ch-tag {
      font-size: 0.65rem;
      color: #ff66ff;
      letter-spacing: 0.15em;
      font-weight: 700;
    }
    .ch-timer { color: #ffaa00; font-size: 0.75rem; }
    .ch-prompt { color: #ddd; font-size: 0.85rem; margin-bottom: 0.75rem; }
    .ch-options { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.75rem; }
    .ch-option {
      padding: 0.6rem;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 4px;
      color: #ccc;
      text-align: left;
      font-size: 0.8rem;
    }
    .ch-option.selected {
      border-color: #00f0ff;
      background: rgba(0, 240, 255, 0.1);
      color: #00f0ff;
    }
    .ch-confirm { width: 100%; margin-bottom: 0.4rem; }
    .ch-skip { width: 100%; font-size: 0.75rem; }
    .terminal-btn {
      padding: 0.75rem;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }
    .terminal-btn.primary {
      background: linear-gradient(135deg, #004466, #006688);
      color: #00f0ff;
      border: 1px solid #00f0ff;
    }
    .terminal-btn.ghost {
      background: transparent;
      color: #888;
      border: 1px solid #444;
    }
    .terminal-btn:disabled { opacity: 0.4; }
  `],
})
export class TextChallengeComponent {
  @Input() challenge: MinigameChallenge | null = null;
  @Input() secondsLeft = 60;
  @Output() answered = new EventEmitter<string | number>();
  @Output() skip = new EventEmitter<void>();

  selectedAnswer: string | number = '';

  selectAnswer(opt: string): void {
    this.selectedAnswer = opt;
  }

  confirm(): void {
    if (this.selectedAnswer !== '' && this.selectedAnswer !== null) {
      this.answered.emit(this.selectedAnswer);
    }
  }
}
