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
import { GamePhase, PublicGameState } from '../../core/models/game-state.model';
import { toVoteEdges } from '../../core/utils/game.utils';
import { computeCircularLayout, NodePosition } from '../../core/utils/layout.utils';

interface VoteLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
}

@Component({
  selector: 'app-vote-lines',
  standalone: true,
  templateUrl: './vote-lines.component.html',
  styleUrl: './vote-lines.component.scss',
})
export class VoteLinesComponent implements OnChanges, AfterViewInit {
  @Input() state: PublicGameState | null = null;
  @Input() phase: GamePhase = 'LOBBY';

  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;

  lines: VoteLine[] = [];
  width = 800;
  height = 600;
  visible = false;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.rebuild();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.viewReady) this.rebuild();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.rebuild();
  }

  private rebuild(): void {
    const el = this.container?.nativeElement;
    if (!el) return;

    this.width = el.clientWidth || 800;
    this.height = el.clientHeight || 600;
    this.visible = this.phase === 'DIA' || this.phase === 'VOTACION';

    if (!this.visible || !this.state) {
      this.lines = [];
      return;
    }

    const players = this.state.players;
    const positions: NodePosition[] = computeCircularLayout(players, this.width, this.height);
    const posMap = new Map(positions.map((p) => [p.id, p]));
    const edges = toVoteEdges(this.state.votes);

    const targetCounts = new Map<string, number>();
    for (const edge of edges) {
      targetCounts.set(edge.to, (targetCounts.get(edge.to) ?? 0) + 1);
    }

    this.lines = edges
      .map((edge) => {
        const from = posMap.get(edge.from);
        const to = posMap.get(edge.to);
        if (!from || !to) return null;

        const count = targetCounts.get(edge.to) ?? 1;
        return {
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          strokeWidth: Math.min(2 + count * 0.8, 6),
        };
      })
      .filter((l): l is VoteLine => l !== null);
  }
}
