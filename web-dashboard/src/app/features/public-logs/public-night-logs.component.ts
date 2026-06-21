import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { PublicLogEntry } from '../../core/models/game-state.model';

@Component({
  selector: 'app-public-night-logs',
  standalone: true,
  template: `
    <aside class="public-logs" [class.visible]="logs.length > 0" [class.has-critical]="hasCritical">
      <header class="logs-header">
        <span class="logs-icon">◈</span>
        <span class="logs-title">SIEM — Feed público</span>
        @if (hasCritical) {
          <span class="logs-alert">ALERTA</span>
        }
      </header>
      <ul class="logs-list">
        @for (log of visibleLogs; track log.id) {
          <li
            class="log-entry"
            [attr.data-severity]="log.severity"
            [class.log-critical-pulse]="log.severity === 'critical' && log.id === newestCriticalId">
            {{ log.message }}
          </li>
        }
      </ul>
    </aside>
  `,
  styles: [`
    .public-logs {
      position: absolute;
      right: 1rem;
      bottom: 1rem;
      width: min(260px, 22vw);
      max-height: 22vh;
      background: rgba(5, 10, 18, 0.92);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      z-index: 20;
      opacity: 0;
      transform: translateX(20px);
      transition: opacity 0.4s, transform 0.4s;
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      font-size: 0.62rem;
      pointer-events: none;
      overflow: hidden;
      min-height: 0;
    }
    .public-logs.visible {
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }
    .public-logs.has-critical {
      border-color: rgba(255, 68, 102, 0.55);
      box-shadow: 0 0 20px rgba(255, 68, 102, 0.15);
      animation: panel-alert 2s ease-in-out infinite;
    }
    .logs-alert {
      margin-left: auto;
      font-size: 0.6rem;
      color: #ff4466;
      letter-spacing: 0.12em;
      animation: blink 1s step-end infinite;
    }
    .logs-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid rgba(0, 240, 255, 0.15);
      color: #00f0ff;
    }
    .logs-title { font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; font-size: 0.65rem; }
    .logs-list {
      list-style: none;
      margin: 0;
      padding: 0.5rem;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    .log-entry {
      padding: 0.35rem 0.5rem;
      margin-bottom: 0.25rem;
      border-left: 2px solid rgba(0, 240, 255, 0.3);
      color: #a8c8d8;
      line-height: 1.4;
      animation: log-in 0.35s ease-out;
    }
    .log-entry[data-severity="critical"] { border-color: #ff4466; color: #ff8899; }
    .log-entry.log-critical-pulse {
      animation: critical-pulse 1.2s ease-in-out infinite;
    }
    .log-entry[data-severity="warn"] { border-color: #ffaa00; color: #ffcc66; }
    .log-entry[data-severity="success"] { border-color: #00ff88; color: #88ffbb; }
    @keyframes log-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes critical-pulse {
      0%, 100% { background: transparent; }
      50% { background: rgba(255, 68, 102, 0.12); }
    }
    @keyframes panel-alert {
      0%, 100% { box-shadow: 0 0 12px rgba(255, 68, 102, 0.1); }
      50% { box-shadow: 0 0 24px rgba(255, 68, 102, 0.25); }
    }
    @keyframes blink {
      50% { opacity: 0.35; }
    }
  `],
})
export class PublicNightLogsComponent implements OnChanges {
  @Input() logs: PublicLogEntry[] = [];
  visibleLogs: PublicLogEntry[] = [];
  hasCritical = false;
  newestCriticalId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['logs']) {
      this.visibleLogs = [...this.logs].slice(-8).reverse();
      const critical = this.visibleLogs.filter((l) => l.severity === 'critical');
      this.hasCritical = critical.length > 0;
      this.newestCriticalId = critical[0]?.id ?? null;
    }
  }
}
