import { LucideAngularModule } from 'lucide-angular';
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
import { estimateTeamComposition, TeamComposition } from '../../core/utils/balance.utils';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
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
  voteMinutes = 1.5;
  minigamesEnabled = true;

  isConfigModalOpen = false;
  configModalMode: 'create' | 'edit' = 'create';

  constructor(private readonly gameSound: GameSoundService) {}

  showCopyToast = false;
  showShareToast = false;
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
      this.state?.phase === 'LOBBY' &&
      this.readyPercentage >= 80
    );
  }

  get canForceStart(): boolean {
    return (
      !this.gameOverActive &&
      this.playerCount >= this.minPlayers &&
      this.state?.phase === 'LOBBY'
    );
  }

  get readyCount(): number {
    return this.state?.players.filter((p) => p.isReady || p.isBot).length ?? 0;
  }

  get readyPercentage(): number {
    if (this.playerCount === 0) return 0;
    return (this.readyCount / this.playerCount) * 100;
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

  get teamComposition(): TeamComposition {
    return estimateTeamComposition(this.playerCount);
  }

  get teamCompositionSegments() {
    const comp = this.teamComposition;
    const totalCap = this.capacity || 1;
    return {
      systemPct: (comp.system / totalCap) * 100,
      blackHatPct: (comp.blackHat / totalCap) * 100,
      chaoticPct: (comp.chaotic / totalCap) * 100,
      emptyPct: (Math.max(0, totalCap - this.playerCount) / totalCap) * 100,
      minMarkerPct: (this.minPlayers / totalCap) * 100
    };
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

  async copyRoomCode() {
    if (!this.roomCode) return;
    try {
      await navigator.clipboard.writeText(this.roomCode);
      this.gameSound.playUi('confirm');
      this.showCopyToast = true;
      setTimeout(() => this.showCopyToast = false, 2000);
    } catch {
      console.error('Error copying code');
    }
  }

  async shareRoomLink() {
    if (!this.roomCode) return;
    const text = `Únete a mi partida de Firewall Protocol. Código de sala: ${this.roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Firewall Protocol',
          text: text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        this.gameSound.playUi('confirm');
        this.showShareToast = true;
        setTimeout(() => this.showShareToast = false, 2000);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Error sharing link', e);
      }
    }
  }

  openConfigModal(mode: 'create' | 'edit'): void {
    this.gameSound.playUi('click');
    this.configModalMode = mode;
    this.isConfigModalOpen = true;
  }

  closeConfigModal(): void {
    this.gameSound.playUi('click');
    this.isConfigModalOpen = false;
  }

  onConfirmConfig(): void {
    this.gameSound.playUi('confirm');
    this.isConfigModalOpen = false;
    
    if (this.configModalMode === 'create') {
      this.createLobby.emit(this.selectedMaxPlayers);
      // Wait for room to be created before sending config
      setTimeout(() => this.onApplyPhaseConfig(), 500);
    } else {
      this.onApplyPhaseConfig();
    }
  }

  onApplyPhaseConfig(): void {
    this.setPhaseConfig.emit({
      autoAdvance: this.autoAdvance,
      nightDurationMs: Math.round(this.nightMinutes * 60_000),
      dayDurationMs: Math.round(this.dayMinutes * 60_000),
      voteDurationMs: Math.round(this.voteMinutes * 60_000),
      minigamesEnabled: this.minigamesEnabled,
    });
  }

  onCreateLobby(): void {
    // Redirigido a openConfigModal('create')
    this.openConfigModal('create');
  }

  onStartGame(): void {
    this.gameSound.playUi('confirm');
    this.setPhaseConfig.emit({
      autoAdvance: this.autoAdvance,
      nightDurationMs: Math.round(this.nightMinutes * 60_000),
      dayDurationMs: Math.round(this.dayMinutes * 60_000),
      voteDurationMs: Math.round(this.voteMinutes * 60_000),
      minigamesEnabled: this.minigamesEnabled,
    });
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
