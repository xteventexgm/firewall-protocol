import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GamePhase, IncidentDisplay, PublicPlayer } from '../../core/models/game-state.model';
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
  @Input() players: PublicPlayer[] = [];
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

  roleFor(playerId: string): string | undefined {
    return (
      this.players.find((p) => p.id === playerId)?.role ??
      this.incidents.find((i) => i.playerId === playerId)?.role
    );
  }

  private triggerDawnFlash(): void {
    this.showDawnFlash = true;
    setTimeout(() => (this.showDawnFlash = false), 2000);
  }
}
