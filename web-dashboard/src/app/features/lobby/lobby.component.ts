import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import QRCode from 'qrcode';
import {
  MIN_PLAYERS_TO_START,
  MAX_PLAYERS,
  PublicGameState,
} from '../../core/models/game-state.model';
import { phaseLabel } from '../../core/utils/game.utils';

@Component({
  selector: 'app-lobby',
  standalone: true,
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent implements OnChanges {
  @Input() roomCode = '';
  @Input() state: PublicGameState | null = null;
  @Input() connected = false;

  @Output() startGame = new EventEmitter<void>();
  @Output() advancePhase = new EventEmitter<void>();
  @Output() createLobby = new EventEmitter<void>();

  qrDataUrl = '';
  readonly minPlayers = MIN_PLAYERS_TO_START;
  readonly maxPlayers = MAX_PLAYERS;

  get playerCount(): number {
    return this.state?.players.length ?? 0;
  }

  get connectedCount(): number {
    return this.state?.players.filter((p) => p.isConnected).length ?? 0;
  }

  get aliveCount(): number {
    return this.state?.players.filter((p) => p.isAlive).length ?? 0;
  }

  get canStart(): boolean {
    return this.playerCount >= this.minPlayers && this.state?.phase === 'LOBBY';
  }

  get phaseText(): string {
    return this.state ? phaseLabel(this.state.phase) : 'Sin sala activa';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['roomCode'] && this.roomCode) {
      void this.generateQr(this.roomCode);
    }
  }

  onCreateLobby(): void {
    this.createLobby.emit();
  }

  onStartGame(): void {
    this.startGame.emit();
  }

  onAdvancePhase(): void {
    this.advancePhase.emit();
  }

  private async generateQr(code: string): Promise<void> {
    try {
      this.qrDataUrl = await QRCode.toDataURL(code, {
        width: 220,
        margin: 2,
        color: { dark: '#00f0ff', light: '#050a1200' },
      });
    } catch {
      this.qrDataUrl = '';
    }
  }
}
