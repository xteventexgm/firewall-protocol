import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TargetOption } from '../../core/models/game-state.model';

@Component({
  selector: 'app-node-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './node-picker.component.html',
  styleUrl: './node-picker.component.scss',
})
export class NodePickerComponent {
  @Input() options: TargetOption[] = [];
  @Input() selectedId = '';
  @Input() placeholder = 'Seleccionar nodo';
  @Input() disabled = false;
  @Output() selectedIdChange = new EventEmitter<string>();

  trackById(_: number, item: TargetOption): string {
    return item.id;
  }

  initial(name: string): string {
    const trimmed = name.trim();
    return (trimmed[0] ?? '?').toUpperCase();
  }

  select(id: string): void {
    if (this.disabled) return;
    this.selectedId = id;
    this.selectedIdChange.emit(id);
  }
}
