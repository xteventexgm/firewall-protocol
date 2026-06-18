import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GamePhase, IncidentDisplay } from '../../core/models/game-state.model';
import { phaseLabel } from '../../core/utils/game.utils';

@Component({
  selector: 'app-phase-overlay',
  standalone: true,
  templateUrl: './phase-overlay.component.html',
  styleUrl: './phase-overlay.component.scss',
})
export class PhaseOverlayComponent implements OnChanges {
  @Input() phase: GamePhase = 'LOBBY';
  @Input() phaseFlash: GamePhase | '' = '';
  @Input() incidents: IncidentDisplay[] = [];
  @Input() showIncidentReport = false;
  @Input() incidentNightNumber = 0;

  showNightOverlay = false;
  showDawnFlash = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['phase']) {
      this.showNightOverlay = this.phase === 'NOCHE';
      if (this.phase === 'DIA' && !changes['phaseFlash']) {
        this.triggerDawnFlash();
      }
    }

    if (changes['phaseFlash'] && this.phaseFlash) {
      this.showNightOverlay = this.phaseFlash === 'NOCHE';
      if (this.phaseFlash === 'DIA') {
        this.triggerDawnFlash();
      }
    }
  }

  phaseLabel = phaseLabel;

  private triggerDawnFlash(): void {
    this.showDawnFlash = true;
    setTimeout(() => (this.showDawnFlash = false), 2000);
  }
}
