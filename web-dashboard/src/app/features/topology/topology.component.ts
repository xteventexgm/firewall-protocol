import { NgClass } from '@angular/common';
import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
  HostListener,
} from '@angular/core';
import { GamePhase, PublicGameState, PublicPlayer } from '../../core/models/game-state.model';
import { countSkipVotes, roleTeamHint } from '../../core/utils/game.utils';
import {
  computeSpiderLayout,
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
export class TopologyComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() state: PublicGameState | null = null;
  @Input() phase: GamePhase = 'LOBBY';
  @Input() glitchPlayerIds: string[] = [];
  @Input() skipVotes = 0;

  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef<HTMLElement>;
  @ViewChild('particlesCanvas') particlesCanvas?: ElementRef<HTMLCanvasElement>;

  nodes: NodePosition[] = [];
  hubLinks: HubLink[] = [];
  hub = { x: 400, y: 300 };
  width = 800;
  height = 600;
  readonly Math = Math;
  private viewReady = false;
  private particleFrame?: number;
  private particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.updateLayout();
    this.initParticles();
    this.animateParticles();
  }

  ngOnDestroy(): void {
    if (this.particleFrame) cancelAnimationFrame(this.particleFrame);
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.viewReady) this.updateLayout();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateLayout();
    this.resizeParticlesCanvas();
  }

  private initParticles(): void {
    const canvas = this.particlesCanvas?.nativeElement;
    if (!canvas) return;
    this.resizeParticlesCanvas();
    this.particles = Array.from({ length: 48 }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      size: 1 + Math.random() * 2,
      alpha: 0.15 + Math.random() * 0.45,
    }));
  }

  private resizeParticlesCanvas(): void {
    const canvas = this.particlesCanvas?.nativeElement;
    if (!canvas) return;
    canvas.width = this.width;
    canvas.height = this.height;
  }

  private animateParticles(): void {
    const canvas = this.particlesCanvas?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, this.width, this.height);
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > this.width) p.vx *= -1;
        if (p.y < 0 || p.y > this.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha})`;
        ctx.fill();
      }
      this.particleFrame = requestAnimationFrame(draw);
    };
    draw();
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
    if (player.infected) return 'node-infected';
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
    if (player.infected) return 'INFECTADO';
    if (player.silenced) return 'SILENCIADO';
    return null;
  }

  isNodeHealthy(player: PublicPlayer): boolean {
    return player.isAlive && player.isConnected && !player.silenced;
  }

  /** Escala nodos y tipografía según cantidad de jugadores (layout araña en layout.utils). */
  get layoutScale(): number {
    const n = this.nodes.length;
    if (n <= 5) return 1;
    if (n <= 8) return 0.9;
    if (n <= 12) return 0.8;
    return 0.7;
  }

  get nodeMetrics() {
    const s = this.layoutScale;
    const outer = 46 * s;
    return {
      outer,
      inner: 36 * s,
      initialSize: Math.round(22 * s),
      nameSize: Math.round(15 * s),
      statusSize: Math.round(13 * s),
      roleSize: Math.round(11 * s),
      nameY: outer + 20,
      statusY: -(outer + 14),
      roleY: -(outer + 30),
      pulseR: 52 * s,
      linkInset: 48 * s,
    };
  }

  statusLabelWidth(label: string): number {
    return Math.max(72, label.length * 7.2);
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
    this.nodes = computeSpiderLayout(players, this.width, this.height);
    this.hub = hubPoint(this.width, this.height);

    this.hubLinks = this.nodes.map((node) => {
      const edge = edgePointToward(node, this.hub.x, this.hub.y, this.nodeMetrics.linkInset);
      return {
        id: node.id,
        x1: this.hub.x,
        y1: this.hub.y,
        x2: edge.x,
        y2: edge.y,
        active: node.player.isAlive && node.player.isConnected,
      };
    });
    this.resizeParticlesCanvas();
  }
}
