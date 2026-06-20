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
import { GamePhase, PublicGameState, VoteTrace } from '../../core/models/game-state.model';
import { countSkipVotes, skipVoterIds, toVoteEdges } from '../../core/utils/game.utils';
import {
  computeCircularLayout,
  edgePointToward,
  hubPoint,
  NodePosition,
} from '../../core/utils/layout.utils';

interface VoteLine {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
  isSkip: boolean;
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
  @Input() highlightTrace: VoteTrace | null = null;
  @Input() voteTied = false;

  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;

  lines: VoteLine[] = [];
  skipLines: VoteLine[] = [];
  skipCount = 0;
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

  isHighlighted(line: VoteLine): boolean {
    if (!this.highlightTrace) return false;
    if (line.isSkip) {
      return this.highlightTrace.target === null && line.from === this.highlightTrace.voter;
    }
    return (
      line.from === this.highlightTrace.voter && line.to === this.highlightTrace.target
    );
  }

  private rebuild(): void {
    const el = this.container?.nativeElement;
    if (!el) return;

    this.width = el.clientWidth || 800;
    this.height = el.clientHeight || 600;
    this.visible = this.phase === 'DIA' || this.phase === 'VOTACION';

    if (!this.visible || !this.state) {
      this.lines = [];
      this.skipLines = [];
      this.skipCount = 0;
      return;
    }

    const players = this.state.players;
    const maxSlots = Math.max(this.state.maxPlayers ?? players.length, players.length);
    const positions: NodePosition[] = computeCircularLayout(
      players,
      this.width,
      this.height,
      maxSlots,
    );
    const posMap = new Map(positions.map((p) => [p.id, p]));
    const hub = hubPoint(this.width, this.height);
    const edges = toVoteEdges(this.state.votes);
    this.skipCount = countSkipVotes(this.state.votes);

    const targetCounts = new Map<string, number>();
    for (const edge of edges) {
      targetCounts.set(edge.to, (targetCounts.get(edge.to) ?? 0) + 1);
    }

    this.lines = edges
      .map((edge) => {
        const from = posMap.get(edge.from);
        const to = posMap.get(edge.to);
        if (!from || !to) return null;

        const fromEdge = edgePointToward(from, to.x, to.y, 28);
        const toEdge = edgePointToward(to, from.x, from.y, 28);
        const count = targetCounts.get(edge.to) ?? 1;
        return {
          from: edge.from,
          to: edge.to,
          x1: fromEdge.x,
          y1: fromEdge.y,
          x2: toEdge.x,
          y2: toEdge.y,
          strokeWidth: Math.min(2 + count * 0.8, 6),
          isSkip: false,
        };
      })
      .filter((l): l is VoteLine => l !== null);

    this.skipLines = skipVoterIds(this.state.votes)
      .map((voterId) => {
        const from = posMap.get(voterId);
        if (!from) return null;
        const fromEdge = edgePointToward(from, hub.x, hub.y, 28);
        const hubEdge = edgePointToward(
          { ...from, x: hub.x, y: hub.y, angle: 0 },
          from.x,
          from.y,
          20,
        );
        return {
          from: voterId,
          to: 'skip',
          x1: fromEdge.x,
          y1: fromEdge.y,
          x2: hubEdge.x,
          y2: hubEdge.y,
          strokeWidth: 1.5,
          isSkip: true,
        };
      })
      .filter((l): l is VoteLine => l !== null);
  }
}
