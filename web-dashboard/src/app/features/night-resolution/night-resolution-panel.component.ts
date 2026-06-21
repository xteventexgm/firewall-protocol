import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { NightResolution, PublicGameState } from '../../core/models/game-state.model';
import {
  buildNightResolutionSections,
  hasNightResolutionContent,
  NightResolutionSection,
} from '../../core/utils/night-resolution.utils';

@Component({
  selector: 'app-night-resolution-panel',
  standalone: true,
  templateUrl: './night-resolution-panel.component.html',
  styleUrl: './night-resolution-panel.component.scss',
})
export class NightResolutionPanelComponent implements OnChanges {
  @Input() resolution: NightResolution | null = null;
  @Input() state: PublicGameState | null = null;
  @Input() visible = false;

  sections: NightResolutionSection[] = [];
  logsExpanded = false;
  hasLogs = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resolution'] || changes['state']) {
      this.refresh();
    }
    if (changes['visible'] && this.visible) {
      this.logsExpanded = false;
    }
  }

  toggleLogs(): void {
    this.logsExpanded = !this.logsExpanded;
  }

  private refresh(): void {
    if (!this.resolution || !hasNightResolutionContent(this.resolution)) {
      this.sections = [];
      this.hasLogs = false;
      return;
    }
    this.sections = buildNightResolutionSections(this.resolution, this.state);
    this.hasLogs = !!this.resolution.logs?.length;
  }
}
