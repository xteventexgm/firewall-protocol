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
  PhaseConfig,
} from '../../core/models/game-state.model';
import { phaseLabel } from '../../core/utils/game.utils';
import { GameSoundService } from '../../core/services/game-sound.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss',
  host: {
    '[class.compact]': 'compactMode',
  },
})
export class LobbyComponent implements OnChanges {
  @Input() inRoom = false;
  @Input() roomCode = '';
  @Input() state: PublicGameState | null = null;
  @Input() connected = false;
  @Input() reconnecting = false;
  @Input() savedRooms: SavedRoom[] = [];
  @Input() savedRoomConnected: Record<string, number> = {};
  @Input() gameOverActive = false;
  @Input() soundMuted = false;
  @Input() isHost = false;

  @Output() startGame = new EventEmitter<void>();
  @Output() advancePhase = new EventEmitter<void>();
  @Output() createLobby = new EventEmitter<number>();
  @Output() backToLobby = new EventEmitter<void>();
  @Output() rejoinRoom = new EventEmitter<string>();
  @Output() spectateLobby = new EventEmitter<string>();
  @Output() removeSavedRoom = new EventEmitter<string>();
  @Output() setPhaseConfig = new EventEmitter<Partial<PhaseConfig>>();
  @Output() toggleSound = new EventEmitter<void>();
  @Output() fillBots = new EventEmitter<void>();
  @Output() clearBots = new EventEmitter<void>();
  @Output() runBotQaMatch = new EventEmitter<void>();

  autoAdvance = false;
  nightMinutes = 1.5;
  dayMinutes = 2;

  constructor(private readonly gameSound: GameSoundService) {}

  qrDataUrl = '';
  selectedMaxPlayers = MIN_PLAYERS_TO_START;
  homeTab: 'create' | 'rooms' = 'create';
  spectateRoomCode = '';
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

  get botCount(): number {
    return this.state?.players.filter((p) => p.isBot).length ?? 0;
  }

  get humanCount(): number {
    return this.state?.players.filter((p) => !p.isBot).length ?? 0;
  }

  get canFillBots(): boolean {
    return (
      !this.gameOverActive &&
      this.state?.phase === 'LOBBY' &&
      this.humanCount > 0 &&
      this.playerCount < this.capacity
    );
  }

  get botsNeededForCapacity(): number {
    return Math.max(0, this.capacity - this.playerCount);
  }

  get canClearBots(): boolean {
    return !this.gameOverActive && this.state?.phase === 'LOBBY' && this.botCount > 0;
  }

  get botQaRunning(): boolean {
    return this.state?.phaseConfig?.botQaAutoRun === true && this.state.phase !== 'LOBBY';
  }

  get canRunBotQaMatch(): boolean {
    return !this.gameOverActive && this.state?.phase === 'LOBBY';
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

  /** Sala en partida activa: panel lateral compacto (sin QR ni timers). */
  get compactMode(): boolean {
    if (!this.inRoom || !this.state) return false;
    if (this.gameOverActive) return true;
    return this.state.phase !== 'LOBBY';
  }

  get phaseText(): string {
    return this.state ? phaseLabel(this.state.phase) : 'Sin sala activa';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inRoom']?.currentValue === false && changes['inRoom']?.previousValue === true) {
      this.homeTab = this.savedRooms.length > 0 ? 'rooms' : 'create';
    }
    if (changes['roomCode'] && this.roomCode && this.inRoom) {
      void this.generateQr(this.roomCode);
    }
    if (changes['state'] && this.state?.phaseConfig) {
      this.autoAdvance = this.state.phaseConfig.autoAdvance;
      this.nightMinutes = this.state.phaseConfig.nightDurationMs / 60_000;
      this.dayMinutes = this.state.phaseConfig.dayDurationMs / 60_000;
    }
  }

  onToggleSound(): void {
    this.gameSound.playUi('click');
    this.toggleSound.emit();
  }

  onApplyPhaseConfig(): void {
    this.gameSound.playUi('confirm');
    this.setPhaseConfig.emit({
      autoAdvance: this.autoAdvance,
      nightDurationMs: Math.round(this.nightMinutes * 60_000),
      dayDurationMs: Math.round(this.dayMinutes * 60_000),
      voteDurationMs: Math.round(this.dayMinutes * 60_000),
    });
  }

  onCreateLobby(): void {
    this.gameSound.playUi('confirm');
    this.createLobby.emit(this.selectedMaxPlayers);
  }

  onStartGame(): void {
    this.gameSound.playUi('confirm');
    this.startGame.emit();
  }

  onFillBots(): void {
    this.gameSound.playUi('confirm');
    this.fillBots.emit();
  }

  onClearBots(): void {
    this.gameSound.playUi('click');
    this.clearBots.emit();
  }

  onRunBotQaMatch(): void {
    this.gameSound.playUi('confirm');
    this.setPhaseConfig.emit({
      autoAdvance: true,
      nightDurationMs: Math.round(this.nightMinutes * 60_000),
      dayDurationMs: Math.round(this.dayMinutes * 60_000),
      voteDurationMs: Math.round(this.dayMinutes * 60_000),
    });
    this.runBotQaMatch.emit();
  }

  onAdvancePhase(): void {
    this.gameSound.playUi('click');
    this.advancePhase.emit();
  }

  onBackToLobby(): void {
    this.gameSound.playUi('click');
    this.backToLobby.emit();
  }

  onRejoinRoom(code: string): void {
    if (!this.connected || !code) return;
    this.gameSound.playUi('confirm');
    this.rejoinRoom.emit(code);
  }

  onSpectateRoom(): void {
    if (!this.connected || !this.spectateRoomCode.trim()) return;
    this.gameSound.playUi('confirm');
    this.spectateLobby.emit(this.spectateRoomCode.trim());
  }

  connectedCountFor(roomId: string): number {
    return this.savedRoomConnected[roomId] ?? 0;
  }

  onRemoveSavedRoom(roomId: string): void {
    this.gameSound.playUi('click');
    this.removeSavedRoom.emit(roomId);
  }

  setHomeTab(tab: 'create' | 'rooms'): void {
    if (this.homeTab === tab) return;
    this.homeTab = tab;
    this.gameSound.playUi('click');
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
