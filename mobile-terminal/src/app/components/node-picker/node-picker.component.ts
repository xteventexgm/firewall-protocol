import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TargetOption } from '../../core/models/game-state.model';
import { environment } from '../../../environments/environment';
import { GameSoundService } from '../../services/game-sound.service';

@Component({
  selector: 'app-node-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './node-picker.component.html',
  styleUrl: './node-picker.component.scss',
})
export class NodePickerComponent {
  private sound = inject(GameSoundService);

  @Input() options: TargetOption[] = [];
  @Input() selectedId = '';
  @Input() placeholder = 'Seleccionar nodo';
  @Input() disabled = false;
  @Output() selectedIdChange = new EventEmitter<string>();

  avatarErrors = new Set<string>();

  trackById(_: number, item: TargetOption): string {
    return item.id;
  }

  initial(name: string): string {
    const trimmed = name.trim();
    return trimmed.slice(0, 2).toUpperCase();
  }

  select(id: string): void {
    if (this.disabled) return;
    this.sound.play('ui_click');
    this.selectedId = id;
    this.selectedIdChange.emit(id);
  }

  getAvatarUrl(player: TargetOption): string {
    const base = environment.apiUrl.replace(/\/$/, '');
    if (player.avatarUrl) {
      let url = player.avatarUrl;
      if (url.startsWith('/api/auth/avatars/')) {
        url = url.replace('/api/auth/avatars/', '/api/media/avatars/');
      }
      return url.startsWith('http') ? url : `${base}${url}`;
    }
    return `${base}/api/media/avatars/${player.id}`;
  }

  handleAvatarError(playerId: string): void {
    this.avatarErrors.add(playerId);
  }
}
