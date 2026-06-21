import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { NightProgress } from '../../core/models/game-state.model';

@Component({
  selector: 'app-night-progress',
  standalone: true,
  template: `
    @if (progress && progress.total > 0) {
      <div class="night-progress">
        <span class="np-label">Acciones nocturnas</span>
        <div class="np-bar">
          <div class="np-fill" [style.width.%]="percent"></div>
        </div>
        <span class="np-count">{{ progress.acted }}/{{ progress.total }}</span>
      </div>
    }
  `,
  styles: [`
    .night-progress {
      position: absolute;
      top: 4.5rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.4rem 1rem;
      background: rgba(5, 10, 18, 0.85);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 20px;
      z-index: 15;
      font-size: 0.75rem;
      color: #88aabb;
    }
    .np-bar {
      width: 120px;
      height: 6px;
      background: rgba(0, 240, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .np-fill {
      height: 100%;
      background: linear-gradient(90deg, #00f0ff, #0088ff);
      border-radius: 3px;
      transition: width 0.5s ease;
    }
    .np-count { color: #00f0ff; font-weight: 600; min-width: 2.5rem; }
  `],
})
export class NightProgressComponent implements OnChanges {
  @Input() progress: NightProgress | null = null;
  percent = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.progress && this.progress.total > 0) {
      this.percent = Math.round((this.progress.acted / this.progress.total) * 100);
    } else {
      this.percent = 0;
    }
  }
}
