import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lobby-closed-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lobby-closed-overlay.component.html',
  styleUrls: ['./lobby-closed-overlay.component.scss'],
})
export class LobbyClosedOverlayComponent {
  @Input() roomId = '';
  @Output() dismissed = new EventEmitter<void>();

  onDismiss(): void {
    this.dismissed.emit();
  }
}
