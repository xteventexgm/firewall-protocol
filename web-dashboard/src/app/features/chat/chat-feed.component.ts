import { Component, Input } from '@angular/core';
import { ChatMessage } from '../../core/models/game-state.model';

@Component({
  selector: 'app-chat-feed',
  standalone: true,
  template: `
    <aside class="chat-panel" [class.collapsed]="collapsed">
      <header class="chat-header" (click)="collapsed = !collapsed">
        <span class="chat-title">◈ Tráfico de red</span>
        <span class="chat-toggle">{{ collapsed ? '▲' : '▼' }}</span>
      </header>
      @if (!collapsed) {
        <ul class="chat-messages">
          @for (msg of messages.slice(-24); track msg.id) {
            <li class="chat-msg" [attr.data-channel]="msg.channel">
              <span class="chat-author">{{ msg.playerName }}</span>
              <span class="chat-text">{{ msg.text }}</span>
            </li>
          }
          @if (messages.length === 0) {
            <li class="chat-empty">Sin paquetes registrados</li>
          }
        </ul>
      }
    </aside>
  `,
  styles: [`
    .chat-panel {
      position: absolute;
      left: 1rem;
      bottom: 1rem;
      right: auto;
      top: auto;
      width: min(260px, 24vw);
      background: rgba(5, 10, 18, 0.92);
      border: 1px solid rgba(0, 240, 255, 0.28);
      border-radius: 6px;
      z-index: 20;
      font-size: 0.82rem;
      box-shadow: 0 0 18px #00f0ff14;
    }
    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.65rem;
      color: #00f0ff;
      cursor: pointer;
      border-bottom: 1px solid rgba(0, 240, 255, 0.12);
      user-select: none;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.06em;
    }
    .chat-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chat-toggle {
      flex-shrink: 0;
      font-size: 0.7rem;
      opacity: 0.75;
    }
    .chat-messages {
      list-style: none;
      margin: 0;
      padding: 0.45rem 0.6rem;
      max-height: 160px;
      overflow-y: auto;
    }
    .chat-msg {
      margin-bottom: 0.4rem;
      line-height: 1.35;
      font-size: 0.8rem;
    }
    .chat-author {
      color: #00f0ff;
      font-weight: 700;
      margin-right: 0.35rem;
      font-size: 0.82rem;
    }
    .chat-text { color: #e8f4fc; font-size: 0.82rem; }
    .chat-msg[data-channel="dead"] .chat-author { color: #9aa0a8; }
    .chat-msg[data-channel="hacker"] .chat-author { color: #ff4466; }
    .chat-empty { color: #667; font-style: italic; padding: 0.35rem; font-size: 0.78rem; }
    .chat-panel.collapsed .chat-messages { display: none; }
  `],
})
export class ChatFeedComponent {
  @Input() messages: ChatMessage[] = [];
  collapsed = true;
}
