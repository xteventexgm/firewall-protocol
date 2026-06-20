import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { SessionThreatBrief } from '../../core/models/game-state.model';

@Component({
  selector: 'app-threat-briefing',
  standalone: true,
  template: `
    @if (visible && brief) {
      <div class="threat-overlay">
        <div class="threat-panel">
          <p class="threat-code">ALERTA SIEM — NIVEL CRÍTICO</p>
          <h1 class="threat-title">RED COMPROMETIDA</h1>
          <p class="threat-lead">
            Se han detectado <strong>{{ brief.hackerCount }}</strong>
            {{ brief.hackerCount === 1 ? 'agente hostil' : 'agentes hostiles' }}
            (Black Hat) y <strong>{{ brief.intruderCount }}</strong>
            {{ brief.intruderCount === 1 ? 'intruso' : 'intrusos' }}
            de origen desconocido en la red.
          </p>
          <ul class="threat-stats">
            <li><span>Nodos en línea</span><strong>{{ brief.nodeCount }}</strong></li>
            <li><span>Defensores estimados</span><strong>{{ brief.systemCount }}</strong></li>
            <li><span>Amenazas activas</span><strong>{{ brief.hackerCount + brief.intruderCount }}</strong></li>
          </ul>
          <p class="threat-footer">
            Credenciales repartidas. Inicia el debate diurno — identifica y expulsa amenazas.
          </p>
          <div class="threat-progress">
            <div class="threat-progress-fill" [style.width.%]="progressPct"></div>
          </div>
          <button type="button" class="threat-dismiss" (click)="dismiss()">Continuar sesión</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .threat-overlay {
      position: absolute;
      inset: 0;
      z-index: 45;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(ellipse at center, #1a0508cc 0%, #050810f5 70%);
      backdrop-filter: blur(4px);
      animation: threat-in 0.6s ease-out;
    }
    .threat-panel {
      width: min(560px, 92%);
      padding: 2rem 2.25rem;
      border: 1px solid #ff2d5566;
      border-radius: 8px;
      background: #0d1018ee;
      box-shadow: 0 0 60px #ff2d5522, inset 0 0 40px #ff2d5508;
      text-align: center;
      font-family: 'JetBrains Mono', 'Consolas', monospace;
    }
    .threat-code {
      margin: 0 0 0.75rem;
      font-size: 0.65rem;
      letter-spacing: 0.28em;
      color: #ff2d55;
      animation: blink 1.2s step-end infinite;
    }
    .threat-title {
      margin: 0 0 1rem;
      font-size: 1.75rem;
      letter-spacing: 0.2em;
      color: #ff8899;
      text-shadow: 0 0 24px #ff2d5544;
    }
    .threat-lead {
      margin: 0 0 1.25rem;
      font-size: 0.85rem;
      line-height: 1.55;
      color: #c8d8e8;
    }
    .threat-lead strong { color: #ffd000; }
    .threat-stats {
      list-style: none;
      margin: 0 0 1.25rem;
      padding: 0.75rem 1rem;
      border: 1px solid #1a3a4a;
      border-radius: 4px;
      background: #081018;
      text-align: left;
    }
    .threat-stats li {
      display: flex;
      justify-content: space-between;
      padding: 0.35rem 0;
      font-size: 0.78rem;
      color: #8ab4c4;
      border-bottom: 1px solid #1a3a4a44;
    }
    .threat-stats li:last-child { border-bottom: none; }
    .threat-stats strong { color: #00f0ff; }
    .threat-footer {
      margin: 0 0 1rem;
      font-size: 0.72rem;
      color: #7a9aaa;
      line-height: 1.45;
    }
    .threat-progress {
      height: 3px;
      background: #1a3a4a;
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 1rem;
    }
    .threat-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff2d55, #ffd000);
      transition: width 0.2s linear;
    }
    .threat-dismiss {
      padding: 0.5rem 1.25rem;
      border: 1px solid #00f0ff66;
      border-radius: 4px;
      background: transparent;
      color: #00f0ff;
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .threat-dismiss:hover {
      background: #00f0ff11;
      box-shadow: 0 0 12px #00f0ff33;
    }
    @keyframes threat-in {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes blink {
      50% { opacity: 0.4; }
    }
  `],
})
export class ThreatBriefingComponent implements OnChanges {
  @Input() brief: SessionThreatBrief | null = null;
  @Input() visible = false;

  @Output() dismissed = new EventEmitter<void>();

  progressPct = 100;
  private timer?: ReturnType<typeof setInterval>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private readonly durationMs = 9000;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.brief) {
      this.startTimer();
    }
    if (changes['visible'] && !this.visible) {
      this.clearTimers();
    }
  }

  dismiss(): void {
    this.clearTimers();
    this.dismissed.emit();
  }

  private startTimer(): void {
    this.clearTimers();
    const started = Date.now();
    this.progressPct = 100;
    this.timer = setInterval(() => {
      const elapsed = Date.now() - started;
      this.progressPct = Math.max(0, 100 - (elapsed / this.durationMs) * 100);
    }, 100);
    this.hideTimer = setTimeout(() => this.dismiss(), this.durationMs);
  }

  private clearTimers(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.timer = undefined;
    this.hideTimer = undefined;
  }
}
