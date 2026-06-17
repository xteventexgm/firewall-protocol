import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GamePhase, IncidentReport } from '../../core/models/game-state.model';
import { phaseLabel } from '../../core/utils/game.utils';

@Component({
  selector: 'app-phase-overlay',
  standalone: true,
  templateUrl: './phase-overlay.component.html',
  styleUrl: './phase-overlay.component.scss',
})
export class PhaseOverlayComponent implements OnChanges {
  @Input() phase: GamePhase = 'LOBBY';
  @Input() incidents: IncidentReport[] = [];
  @Input() showIncidentReport = false;

  showNightOverlay = false;
  showDawnFlash = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['phase']) {
      this.showNightOverlay = this.phase === 'NOCHE';
      if (this.phase === 'DIA') {
        this.showDawnFlash = true;
        setTimeout(() => (this.showDawnFlash = false), 2000);
      }
    }
  }

  phaseLabel = phaseLabel;
}
