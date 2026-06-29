import { Component, Input } from '@angular/core';
import { NodeDeathAlertData } from '../../core/utils/node-death-alert.utils';

@Component({
  selector: 'app-node-death-alert',
  standalone: true,
  template: `
    @if (visible && alert) {
      <div
        class="node-death-backdrop"
        [class.node-death-backdrop--exit]="exiting"
        aria-live="assertive"
        role="alert"
      >
        <div class="node-death-card" [class.node-death-card--exit]="exiting">
          <div class="node-death-scanline" aria-hidden="true"></div>
          <p class="node-death-kicker">ALERTA DE RED</p>
          <h2 class="node-death-headline">{{ alert.headline }}</h2>
          <div class="node-death-names">
            @for (p of alert.players; track p.name) {
              <div class="node-death-player-block">
                <span class="node-death-name">{{ p.name }}</span>
                @if (p.role) {
                  <span class="node-death-role">{{ p.role }}</span>
                }
              </div>
            }
          </div>
          <p class="node-death-sub">{{ alert.subtitle }}</p>
          <div class="node-death-bar" aria-hidden="true">
            <span class="node-death-bar-fill"></span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .node-death-backdrop {
        position: absolute;
        inset: 0;
        z-index: 55;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        background: rgba(5, 8, 14, 0.72);
        backdrop-filter: blur(4px);
        pointer-events: none;
        animation: node-death-backdrop-in 0.35s ease-out;
      }

      .node-death-backdrop--exit {
        animation: node-death-backdrop-out 0.45s ease-in forwards;
      }

      .node-death-card {
        position: relative;
        width: min(640px, 92vw);
        min-height: 200px;
        padding: 2rem 2.25rem 1.75rem;
        text-align: center;
        border: 2px solid #ff2d55;
        border-radius: 10px;
        background: linear-gradient(165deg, rgba(40, 8, 16, 0.96) 0%, rgba(12, 6, 10, 0.98) 100%);
        box-shadow:
          0 0 0 1px #ff2d5544 inset,
          0 0 60px #ff2d5528,
          0 24px 48px rgba(0, 0, 0, 0.55);
        overflow: hidden;
        animation: node-death-card-in 0.55s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .node-death-card--exit {
        animation: node-death-card-out 0.4s ease-in forwards;
      }

      .node-death-scanline {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          rgba(255, 45, 85, 0.03) 3px,
          rgba(255, 45, 85, 0.03) 4px
        );
        pointer-events: none;
        animation: node-death-flicker 2.8s linear infinite;
      }

      .node-death-kicker {
        margin: 0 0 0.65rem;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.28em;
        color: #ff6b84;
        text-transform: uppercase;
      }

      .node-death-headline {
        margin: 0 0 1rem;
        font-size: clamp(1.35rem, 3.2vw, 2rem);
        font-weight: 800;
        letter-spacing: 0.14em;
        color: #ffe8ec;
        text-shadow: 0 0 24px #ff2d5566;
        animation: node-death-glitch 2.4s steps(2, end) infinite;
      }

      .node-death-names {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.5rem 0.75rem;
        margin-bottom: 0.85rem;
      }

      .node-death-player-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
      }

      .node-death-name {
        display: inline-block;
        padding: 0.35rem 0.85rem;
        border-radius: 4px;
        border: 1px solid #ff2d5566;
        background: #ff2d5514;
        font-size: clamp(1rem, 2.4vw, 1.25rem);
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.04em;
      }

      .node-death-role {
        font-size: 0.8rem;
        opacity: 0.8;
        color: #ff6b84;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.1em;
      }

      .node-death-sub {
        margin: 0;
        font-size: 0.82rem;
        letter-spacing: 0.06em;
        color: #c9a0a8;
        text-transform: uppercase;
      }

      .node-death-bar {
        margin-top: 1.25rem;
        height: 3px;
        border-radius: 2px;
        background: #ff2d5522;
        overflow: hidden;
      }

      .node-death-bar-fill {
        display: block;
        height: 100%;
        width: 100%;
        background: linear-gradient(90deg, #ff2d55, #ff6b84);
        transform-origin: left center;
        animation: node-death-progress 4s linear forwards;
      }

      @keyframes node-death-backdrop-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes node-death-backdrop-out {
        to {
          opacity: 0;
        }
      }

      @keyframes node-death-card-in {
        0% {
          opacity: 0;
          transform: scale(0.88) translateY(12px);
        }
        60% {
          transform: scale(1.02) translateY(0);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes node-death-card-out {
        to {
          opacity: 0;
          transform: scale(0.94) translateY(-8px);
        }
      }

      @keyframes node-death-glitch {
        0%,
        92%,
        100% {
          transform: translate(0);
        }
        93% {
          transform: translate(-2px, 1px);
        }
        95% {
          transform: translate(2px, -1px);
        }
      }

      @keyframes node-death-flicker {
        0%,
        100% {
          opacity: 0.35;
        }
        50% {
          opacity: 0.65;
        }
      }

      @keyframes node-death-progress {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }
    `,
  ],
})
export class NodeDeathAlertComponent {
  @Input() visible = false;
  @Input() exiting = false;
  @Input() alert: NodeDeathAlertData | null = null;
}
