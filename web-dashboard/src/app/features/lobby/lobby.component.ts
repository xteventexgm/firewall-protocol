import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import QRCode from 'qrcode';
import {
  MIN_PLAYERS_TO_START,
  MAX_PLAYERS,
  PublicGameState,
  SavedRoom,
} from '../../core/models/game-state.model';
import { phaseLabel } from '../../core/utils/game.utils';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent implements OnChanges {
  @Input() inRoom = false;
  @Input() roomCode = '';
  @Input() state: PublicGameState | null = null;
  @Input() connected = false;
  @Input() savedRooms: SavedRoom[] = [];
  @Input() gameOverActive = false;

  @Output() startGame = new EventEmitter<void>();
  @Output() advancePhase = new EventEmitter<void>();
  @Output() createLobby = new EventEmitter<number>();
  @Output() backToLobby = new EventEmitter<void>();
  @Output() rejoinRoom = new EventEmitter<string>();
  @Output() removeSavedRoom = new EventEmitter<string>();

  qrDataUrl = '';
  selectedMaxPlayers = MIN_PLAYERS_TO_START;
  readonly minPlayers = MIN_PLAYERS_TO_START;
  readonly maxPlayers = MAX_PLAYERS;

  get playerCount(): number {
    return this.state?.playerCount ?? this.state?.players.length ?? 0;
  }

  get capacity(): number {
    return this.state?.maxPlayers ?? this.selectedMaxPlayers;
  }

  get connectedCount(): number {
    return this.state?.players.filter((p) => p.isConnected).length ?? 0;
  }

  get aliveCount(): number {
    return this.state?.players.filter((p) => p.isAlive).length ?? 0;
  }

  get canStart(): boolean {
    return (
      !this.gameOverActive &&
      this.playerCount >= this.minPlayers &&
      this.state?.phase === 'LOBBY'
    );
  }

  get canAdvance(): boolean {
    return (
      !this.gameOverActive &&
      !!this.state &&
      this.state.phase !== 'LOBBY' &&
      this.state.phase !== 'FIN' &&
      this.state.phase !== 'REPARTO'
    );
  }

  get phaseText(): string {
    return this.state ? phaseLabel(this.state.phase) : 'Sin sala activa';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['roomCode'] && this.roomCode && this.inRoom) {
      void this.generateQr(this.roomCode);
    }
  }

  onCreateLobby(): void {
    this.createLobby.emit(this.selectedMaxPlayers);
  }

  onStartGame(): void {
    this.startGame.emit();
  }

  onAdvancePhase(): void {
    this.advancePhase.emit();
  }

  onBackToLobby(): void {
    this.backToLobby.emit();
  }

  onRejoinRoom(roomId: string): void {
    this.rejoinRoom.emit(roomId);
  }

  onRemoveSavedRoom(roomId: string): void {
    this.removeSavedRoom.emit(roomId);
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
