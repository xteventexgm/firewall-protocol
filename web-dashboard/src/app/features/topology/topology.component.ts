import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
  HostListener,
} from '@angular/core';
import { GamePhase, PublicGameState, PublicPlayer } from '../../core/models/game-state.model';
import { isNodeCritical } from '../../core/utils/game.utils';
import { computeCircularLayout, NodePosition } from '../../core/utils/layout.utils';

@Component({
  selector: 'app-topology',
  standalone: true,
  templateUrl: './topology.component.html',
  styleUrl: './topology.component.scss',
})
export class TopologyComponent implements OnChanges, AfterViewInit {
  @Input() state: PublicGameState | null = null;
  @Input() phase: GamePhase = 'LOBBY';
  @Input() glitchPlayerIds: string[] = [];

  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<HTMLElement>;

  nodes: NodePosition[] = [];
  width = 800;
  height = 600;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.updateLayout();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.viewReady) this.updateLayout();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateLayout();
  }

  isGlitching(id: string): boolean {
    return this.glitchPlayerIds.includes(id);
  }

  isDimmed(): boolean {
    return this.phase === 'NOCHE';
  }

  nodeClass(player: PublicPlayer): string {
    if (isNodeCritical(player)) return 'node-dead';
    if (this.phase === 'VOTACION' || this.phase === 'DIA') return 'node-active';
    return 'node-online';
  }

  nodeStatusLabel(player: PublicPlayer): string | null {
    if (!player.isAlive) return 'BANEADO';
    if (!player.isConnected) return 'DESCONECTADO';
    return null;
  }

  isNodeHealthy(player: PublicPlayer): boolean {
    return player.isAlive && player.isConnected;
  }

  private updateLayout(): void {
    const el = this.svgContainer?.nativeElement;
    if (!el) return;

    this.width = el.clientWidth || 800;
    this.height = el.clientHeight || 600;
    const players = this.state?.players ?? [];
    this.nodes = computeCircularLayout(players, this.width, this.height);
  }
}
