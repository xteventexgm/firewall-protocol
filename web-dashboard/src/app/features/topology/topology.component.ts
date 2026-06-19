import { NgClass } from '@angular/common';
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
import { countSkipVotes, roleTeamHint } from '../../core/utils/game.utils';
import {
  computeCircularLayout,
  edgePointToward,
  hubPoint,
  NodePosition,
} from '../../core/utils/layout.utils';

interface HubLink {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
}

@Component({
  selector: 'app-topology',
  standalone: true,
  imports: [NgClass],
  templateUrl: './topology.component.html',
  styleUrl: './topology.component.scss',
})
export class TopologyComponent implements OnChanges, AfterViewInit {
  @Input() state: PublicGameState | null = null;
  @Input() phase: GamePhase = 'LOBBY';
  @Input() glitchPlayerIds: string[] = [];
  @Input() skipVotes = 0;

  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<HTMLElement>;

  nodes: NodePosition[] = [];
  hubLinks: HubLink[] = [];
  hub = { x: 400, y: 300 };
  width = 800;
  height = 600;
  readonly Math = Math;
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

  get effectiveSkipVotes(): number {
    return this.skipVotes || countSkipVotes(this.state?.votes ?? {});
  }

  isGlitching(id: string): boolean {
    return this.glitchPlayerIds.includes(id);
  }

  isDimmed(): boolean {
    return this.phase === 'NOCHE';
  }

  showVoteStats(): boolean {
    return this.phase === 'VOTACION' || this.phase === 'DIA';
  }

  nodeClass(player: PublicPlayer): string {
    if (!player.isAlive) return 'node-dead';
    if (!player.isConnected) return 'node-offline';
    if (player.silenced) return 'node-silenced';
    if (this.phase === 'VOTACION' || this.phase === 'DIA') return 'node-active';
    return 'node-online';
  }

  nodeClasses(player: PublicPlayer): Record<string, boolean> {
    const team = roleTeamHint(player.role);
    return {
      'player-node': true,
      [this.nodeClass(player)]: true,
      [`team-${team}`]: !!team,
    };
  }

  showRole(player: PublicPlayer): boolean {
    return !!player.role && this.phase === 'FIN' && player.isAlive;
  }

  nodeStatusLabel(player: PublicPlayer): string | null {
    if (!player.isAlive) return player.role ? `BANEADO · ${player.role}` : 'BANEADO';
    if (!player.isConnected) return 'DESCONECTADO';
    if (player.silenced) return 'SILENCIADO';
    return null;
  }

  isNodeHealthy(player: PublicPlayer): boolean {
    return player.isAlive && player.isConnected && !player.silenced;
  }

  hexPoints(radius: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      pts.push(`${radius * Math.cos(angle)},${radius * Math.sin(angle)}`);
    }
    return pts.join(' ');
  }

  private updateLayout(): void {
    const el = this.svgContainer?.nativeElement;
    if (!el) return;

    this.width = el.clientWidth || 800;
    this.height = el.clientHeight || 600;
    const players = this.state?.players ?? [];
    this.nodes = computeCircularLayout(players, this.width, this.height);
    this.hub = hubPoint(this.width, this.height);

    this.hubLinks = this.nodes.map((node) => {
      const edge = edgePointToward(node, this.hub.x, this.hub.y);
      return {
        id: node.id,
        x1: this.hub.x,
        y1: this.hub.y,
        x2: edge.x,
        y2: edge.y,
        active: node.player.isAlive && node.player.isConnected,
      };
    });
  }
}
