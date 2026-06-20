import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ChatMessage } from '../../core/models/game-state.model';

@Component({
  selector: 'app-chat-feed',
  standalone: true,
  template: `
    <aside class="chat-panel" [class.collapsed]="collapsed">
      <header class="chat-header" (click)="collapsed = !collapsed">
        <span>💬 Chat en vivo</span>
        <span class="chat-toggle">{{ collapsed ? '▲' : '▼' }}</span>
      </header>
      @if (!collapsed) {
        <ul class="chat-messages">
          @for (msg of messages.slice(-30); track msg.id) {
            <li class="chat-msg" [attr.data-channel]="msg.channel">
              <span class="chat-author">{{ msg.playerName }}</span>
              <span class="chat-text">{{ msg.text }}</span>
            </li>
          }
          @if (messages.length === 0) {
            <li class="chat-empty">Sin mensajes aún</li>
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
      width: min(440px, 36vw);
      background: rgba(5, 10, 18, 0.94);
      border: 1px solid rgba(0, 240, 255, 0.28);
      border-radius: 6px;
      z-index: 20;
      font-size: 0.95rem;
      box-shadow: 0 0 24px #00f0ff18;
    }
    .chat-header {
      display: flex;
      justify-content: space-between;
      padding: 0.65rem 0.9rem;
      color: #00f0ff;
      cursor: pointer;
      border-bottom: 1px solid rgba(0, 240, 255, 0.15);
      user-select: none;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .chat-messages {
      list-style: none;
      margin: 0;
      padding: 0.65rem 0.85rem;
      max-height: 280px;
      overflow-y: auto;
    }
    .chat-msg {
      margin-bottom: 0.55rem;
      line-height: 1.45;
      font-size: 0.92rem;
    }
    .chat-author {
      color: #00f0ff;
      font-weight: 700;
      margin-right: 0.45rem;
      font-size: 0.95rem;
    }
    .chat-text { color: #e8f4fc; font-size: 0.95rem; }
    .chat-msg[data-channel="dead"] .chat-author { color: #9aa0a8; }
    .chat-msg[data-channel="hacker"] .chat-author { color: #ff4466; }
    .chat-empty { color: #667; font-style: italic; padding: 0.5rem; font-size: 0.9rem; }
    .chat-panel.collapsed .chat-messages { display: none; }
  `],
})
export class ChatFeedComponent {
  @Input() messages: ChatMessage[] = [];
  collapsed = false;
}
