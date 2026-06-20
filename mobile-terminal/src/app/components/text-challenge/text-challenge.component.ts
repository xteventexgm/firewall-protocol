import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MinigameChallenge } from '../../core/models/game-state.model';

export type ChallengeFeedbackType = 'none' | 'success' | 'error';

@Component({
  selector: 'app-text-challenge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './text-challenge.component.html',
  styleUrl: './text-challenge.component.scss',
})
export class TextChallengeComponent implements OnChanges, OnDestroy {
  @Input() challenge: MinigameChallenge | null = null;
  @Input() pending = false;
  @Input() feedbackType: ChallengeFeedbackType = 'none';
  @Input() feedbackMessage = '';
  @Output() answered = new EventEmitter<string | number>();
  @Output() skip = new EventEmitter<void>();

  selectedAnswer: string | number = '';
  secondsLeft = 0;

  private timer?: ReturnType<typeof setInterval>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['challenge']) {
      this.selectedAnswer = '';
      this.startTimer();
    }
    if (changes['feedbackType'] && this.feedbackType === 'error') {
      this.selectedAnswer = '';
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  get typeLabel(): string {
    switch (this.challenge?.type) {
      case 'pick_logs':
        return 'Análisis de logs';
      case 'match_pair':
        return 'Emparejar amenaza';
      case 'timing':
        return 'Sincronización';
      case 'sequence':
        return 'Secuencia de protocolo';
      case 'trivia':
        return 'Juicio táctico';
      default:
        return 'Precisión nocturna';
    }
  }

  selectAnswer(opt: string): void {
    if (this.pending) return;
    this.selectedAnswer = opt;
  }

  confirm(): void {
    if (this.pending || this.selectedAnswer === '' || this.selectedAnswer === null) return;
    this.answered.emit(this.selectedAnswer);
  }

  private startTimer(): void {
    this.clearTimer();
    if (!this.challenge?.expiresAt) {
      this.secondsLeft = 75;
      return;
    }
    const tick = () => {
      this.secondsLeft = Math.max(0, Math.ceil((this.challenge!.expiresAt - Date.now()) / 1000));
      if (this.secondsLeft <= 0) this.clearTimer();
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
