import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-role-distribution-overlay',
  standalone: true,
  template: `
    @if (visible) {
      <div class="role-dist-overlay">
        <div class="role-dist-panel">
          <p class="role-dist-code">FW-CORE // CREDENTIAL DISPATCH</p>
          <h1 class="role-dist-title">Distribuyendo roles</h1>
          <p class="role-dist-lead">
            Asignando credenciales y permisos a cada nodo de la red.
            Los terminales móviles reciben su briefing privado.
          </p>
          <div class="role-dist-scan" aria-hidden="true">
            @for (n of scanNodes; track n) {
              <span class="role-dist-node" [style.animation-delay.ms]="n * 180"></span>
            }
          </div>
          <ul class="role-dist-log">
            @for (line of logLines; track line; let i = $index) {
              <li class="role-dist-log-line" [class.visible]="visibleLine >= i">{{ line }}</li>
            }
          </ul>
          <div class="role-dist-progress">
            <div class="role-dist-progress-fill" [style.width.%]="progressPct"></div>
          </div>
          <button type="button" class="role-dist-skip" (click)="dismiss()">Continuar sesión</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .role-dist-overlay {
      position: absolute;
      inset: 0;
      z-index: 44;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(ellipse at center, #0a1828ee 0%, #050810f8 72%);
      backdrop-filter: blur(5px);
      animation: role-dist-in 0.7s ease-out;
    }
    .role-dist-panel {
      width: min(580px, 92%);
      padding: 2rem 2.25rem;
      border: 1px solid #00f0ff55;
      border-radius: 8px;
      background: #081018ee;
      box-shadow: 0 0 48px #00f0ff18, inset 0 0 32px #00f0ff06;
      text-align: center;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
    }
    .role-dist-code {
      margin: 0 0 0.75rem;
      font-size: 0.62rem;
      letter-spacing: 0.26em;
      color: #00f0ff;
      animation: role-dist-blink 1.4s step-end infinite;
    }
    .role-dist-title {
      margin: 0 0 0.85rem;
      font-size: 1.65rem;
      letter-spacing: 0.14em;
      color: #b8e8f8;
      text-shadow: 0 0 20px #00f0ff33;
    }
    .role-dist-lead {
      margin: 0 0 1.25rem;
      font-size: 0.82rem;
      line-height: 1.55;
      color: #8ab4c4;
    }
    .role-dist-scan {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 1.1rem;
    }
    .role-dist-node {
      width: 14px;
      height: 14px;
      border: 1px solid #00f0ff66;
      transform: rotate(30deg);
      opacity: 0.25;
      animation: role-dist-node 1.6s ease-in-out infinite;
    }
    .role-dist-log {
      list-style: none;
      margin: 0 0 1rem;
      padding: 0.65rem 0.85rem;
      border: 1px solid #1a3a4a;
      border-radius: 4px;
      background: #050a10;
      text-align: left;
      min-height: 5.5rem;
    }
    .role-dist-log-line {
      font-size: 0.72rem;
      color: #6a9aaa;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.45s ease, transform 0.45s ease;
      padding: 0.2rem 0;
    }
    .role-dist-log-line.visible {
      opacity: 1;
      transform: translateY(0);
      color: #9ec8dc;
    }
    .role-dist-progress {
      height: 3px;
      background: #1a3a4a;
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 1rem;
    }
    .role-dist-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00f0ff, #0088cc);
      transition: width 0.25s linear;
    }
    .role-dist-skip {
      padding: 0.45rem 1.1rem;
      border: 1px solid #00f0ff44;
      border-radius: 4px;
      background: transparent;
      color: #00f0ff;
      font-size: 0.68rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .role-dist-skip:hover {
      background: #00f0ff10;
    }
    @keyframes role-dist-in {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes role-dist-blink {
      50% { opacity: 0.45; }
    }
    @keyframes role-dist-node {
      0%, 100% { opacity: 0.2; box-shadow: none; }
      50% { opacity: 1; box-shadow: 0 0 10px #00f0ff88; }
    }
  `],
})
export class RoleDistributionOverlayComponent implements OnChanges {
  @Input() visible = false;
  @Output() dismissed = new EventEmitter<void>();

  readonly scanNodes = [0, 1, 2, 3, 4, 5, 6];
  readonly logLines = [
    '> Emparejando sockets con identidades…',
    '> Generando tokens de sesión…',
    '> Firmando credenciales por rol…',
    '> Sincronizando SIEM y terminales móviles…',
    '> Reparto completado — esperando confirmación de nodos…',
  ];

  progressPct = 100;
  visibleLine = -1;

  private timer?: ReturnType<typeof setInterval>;
  private lineTimer?: ReturnType<typeof setInterval>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private readonly durationMs = 20000;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
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
    this.visibleLine = -1;
    let lineIdx = 0;
    this.lineTimer = setInterval(() => {
      this.visibleLine = lineIdx;
      lineIdx += 1;
      if (lineIdx >= this.logLines.length) {
        clearInterval(this.lineTimer);
        this.lineTimer = undefined;
      }
    }, 3200);
    this.timer = setInterval(() => {
      const elapsed = Date.now() - started;
      this.progressPct = Math.max(0, 100 - (elapsed / this.durationMs) * 100);
    }, 120);
    this.hideTimer = setTimeout(() => this.dismiss(), this.durationMs);
  }

  private clearTimers(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.lineTimer) clearInterval(this.lineTimer);
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.timer = undefined;
    this.lineTimer = undefined;
    this.hideTimer = undefined;
  }
}
