import { LucideAngularModule } from 'lucide-angular';
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
  @Input() dayNumber = 0;
  @Input() incidents: IncidentDisplay[] = [];
  @Input() players: PublicPlayer[] = [];
  @Input() showIncidentReport = false;
  @Input() incidentNightNumber = 0;
  @Input() voteTiedMessage = '';
  @Input() voteUrgentSeconds = 0;
  @Input() blockPhaseOverlays = false;

  showNightOverlay = false;
  showDawnFlash = false;
  showBootSequence = false;
  bootLines: string[] = [];
  private prevPhase: GamePhase = 'LOBBY';
  private bootTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['phase']) {
      if (this.phase === 'DIA' && this.prevPhase === 'REPARTO' && this.dayNumber > 1) {
        this.triggerBootSequence();
      }
      this.prevPhase = this.phase;
      this.showNightOverlay = this.phase === 'NOCHE';
      if (this.phase === 'DIA' && !changes['phaseFlash'] && !this.blockPhaseOverlays) {
        this.triggerDawnFlash();
      }
    }

    if (changes['phaseFlash'] && this.phaseFlash) {
      this.showNightOverlay = this.phaseFlash === 'NOCHE';
      if (this.phaseFlash === 'DIA' && !this.blockPhaseOverlays) {
        this.triggerDawnFlash();
      }
    }

    // Si el aviso quedó bloqueado por animación de muerte, mostrarlo al desbloquear.
    if (changes['blockPhaseOverlays'] && !this.blockPhaseOverlays) {
      this.syncNightOverlayIfNeeded();
    }

    if (this.blockPhaseOverlays) {
      this.showDawnFlash = false;
    }
  }

  private syncNightOverlayIfNeeded(): void {
    if (this.phase === 'NOCHE' || this.phaseFlash === 'NOCHE') {
      this.showNightOverlay = true;
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

  private triggerBootSequence(): void {
    clearTimeout(this.bootTimer);
    this.bootLines = [
      '> FIREWALL PROTOCOL v2.0 — boot sequence',
      '> Verificando integridad de nodos... OK',
      '> Reparto de credenciales... OK',
      '> SIEM en línea — modo debate activo',
      '> Día 1 iniciado. Buena suerte.',
    ];
    this.showBootSequence = true;
    this.bootTimer = setTimeout(() => {
      this.showBootSequence = false;
      this.bootLines = [];
    }, 4200);
  }
}
