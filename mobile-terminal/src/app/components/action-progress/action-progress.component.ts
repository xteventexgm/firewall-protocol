import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NightProgress } from '../../core/models/game-state.model';

@Component({
  selector: 'app-action-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="action-progress" *ngIf="progress && progress.total > 0">
      <div class="ap-header">
        <span class="ap-label">Progreso nocturno</span>
        <span class="ap-count">{{ progress.acted }}/{{ progress.total }}</span>
      </div>
      <div class="ap-bar">
        <div class="ap-fill" [style.width.%]="percent"></div>
      </div>
      <p class="ap-hint" *ngIf="progress.acted < progress.total">Esperando acciones de otros nodos…</p>
      <p class="ap-hint done" *ngIf="progress.acted >= progress.total">Todos los nodos activos han actuado</p>
    </div>
  `,
  styles: [`
    .action-progress {
      margin: 0.75rem 0;
      padding: 0.75rem;
      background: rgba(0, 20, 30, 0.6);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 4px;
    }
    .ap-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #88aabb;
      margin-bottom: 0.4rem;
    }
    .ap-count { color: #00f0ff; font-weight: 700; }
    .ap-bar {
      height: 6px;
      background: rgba(0, 240, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .ap-fill {
      height: 100%;
      background: linear-gradient(90deg, #00f0ff, #0066ff);
      transition: width 0.5s ease;
    }
    .ap-hint { font-size: 0.7rem; color: #667; margin: 0.4rem 0 0; }
    .ap-hint.done { color: #00cc88; }
  `],
})
export class ActionProgressComponent {
  @Input() progress: NightProgress | null = null;

  get percent(): number {
    if (!this.progress?.total) return 0;
    return Math.round((this.progress.acted / this.progress.total) * 100);
  }
}
