import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SocketService } from '../../services/socket/socket.service';
import { QrScannerService } from '../../services/qr-scanner.service';
import { formatServerErrorForToast, parseServerErrorMessage } from '../../core/utils/error.utils';
import { LobbyClosedOverlayComponent } from '../../components/lobby-closed-overlay/lobby-closed-overlay.component';
import { HomeAtmosphereComponent } from '../../components/home-atmosphere/home-atmosphere.component';
import { AccountPanelComponent } from '../../components/account-panel/account-panel.component';
import { GameSoundService } from '../../services/game-sound.service';
import { AuthService } from '../../services/auth/auth.service';
import { fetchRoomStatus, isRoomStatusUnavailable } from '../../core/utils/room-status.utils';
import {
  getStoredApiUrl,
  resolveApiBase,
  setStoredApiUrl,
} from '../../core/utils/api-base.utils';
import { environment } from '../../../environments/environment';
import { Subscription, filter, take, timeout, catchError, of, Subject, debounceTime } from 'rxjs';

export interface RecentRoom {
  roomId: string;
  timestamp: number;
}


@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    FormsModule,
    CommonModule,
    LobbyClosedOverlayComponent,
    HomeAtmosphereComponent,
    AccountPanelComponent,
  ],
})
export class LoginPage implements OnInit, OnDestroy {
  roomCode = '';
  playerName = '';
  connecting = false;
  scanning = false;
  connected = false;
  errorMessage = '';
  step: 'room' | 'alias' = 'room';
  pendingReconnect: { roomId: string; phaseLabel: string } | null = null;
  validatingRoom = false;
  showLobbyClosedOverlay = false;
  showAccountPanel = false;
  accountPanelAuthMode: 'verify' | null = null;
  accountAvatarUrl: string | null = null;
  showServerConfig = false;
  serverUrlInput = '';

  // Boot sequence variables
  showBootSequence = false;
  bootStep = 0;
  displayedBootText = '';
  displayedSubText = '';
  displayedDecryptText = '';
  fullBootText = 'FIREWALL PROTOCOL';
  bootFlash = false;
  formReady = false;
  formReadyInstant = false;
  
  roomValidationState: 'idle' | 'checking' | 'valid' | 'invalid' = 'idle';
  roomValidationMessage = '';
  recentRooms: RecentRoom[] = [];
  animState: 0 | 1 | 2 = 0;
  private readonly RECONNECT_DELAY = 1200;
  transitioning = false;
  private roomCodeSubject = new Subject<string>();
  
  private bootTimeouts: any[] = [];

  private subs = new Subscription();

  constructor(
    private socketService: SocketService,
    private qrScanner: QrScannerService,
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private gameSound: GameSoundService,
    private authService: AuthService,
  ) {
    this.subs.add(
      this.authService.profileUpdated$.subscribe(() => void this.refreshAccountAvatar()),
    );
    this.subs.add(
      this.authService.avatarBlobChanged$.subscribe((blob) => {
        this.accountAvatarUrl = blob;
      }),
    );
    this.subs.add(
      this.socketService.connected$.subscribe((c) => {
        this.connected = c;
        if (c && this.errorMessage.startsWith('No se pudo conectar')) {
          this.errorMessage = '';
        }
      }),
    );
    this.subs.add(
      this.socketService.error$.subscribe((msg) => {
        if (!this.connected && msg.startsWith('No se pudo conectar')) {
          this.errorMessage = msg;
        }
      }),
    );
    
    this.subs.add(
      this.roomCodeSubject.pipe(
        debounceTime(500)
      ).subscribe((code) => {
        void this.validateRoomCode(code);
      })
    );
  }

  ngOnInit(): void {
    this.serverUrlInput = getStoredApiUrl() || environment.apiUrl;
    this.syncPlayerNameFromAccount();

    const finished = this.route.snapshot.queryParamMap.get('finished');
    if (finished) {
      void this.showToast('Partida terminada. Escanea o ingresa un código para jugar de nuevo.', 'success');
    }

    const joinError = this.route.snapshot.queryParamMap.get('error');
    if (joinError === 'lobby_closed') {
      this.step = 'room';
      this.roomCode = '';
      this.pendingReconnect = null;
      this.errorMessage = '';
      this.showLobbyClosedOverlay = true;
    } else if (joinError) {
      void this.showToast(formatServerErrorForToast(`error (${joinError})`), 'warning');
    }

    this.checkBootSequence();

    this.socketService.connect();
    void this.checkPendingReconnect();
    void this.refreshAccountAvatar();
    this.loadRecentRooms();
    if (this.isLoggedIn) void this.bootstrapAccountSession();
  }

  loadRecentRooms(): void {
    try {
      const stored = localStorage.getItem('recent_rooms_firewall');
      if (stored) {
        this.recentRooms = JSON.parse(stored);
      }
    } catch {
      this.recentRooms = [];
    }
  }

  saveRecentRoom(roomId: string): void {
    const newRoom: RecentRoom = { roomId, timestamp: Date.now() };
    const filtered = this.recentRooms.filter(r => r.roomId !== roomId);
    this.recentRooms = [newRoom, ...filtered].slice(0, 5);
    localStorage.setItem('recent_rooms_firewall', JSON.stringify(this.recentRooms));
  }

  removeRecentRoom(roomId: string): void {
    this.recentRooms = this.recentRooms.filter(r => r.roomId !== roomId);
    localStorage.setItem('recent_rooms_firewall', JSON.stringify(this.recentRooms));
  }

  selectRecentRoom(roomId: string): void {
    this.onRoomCodeChange(roomId);
  }

  timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'hace un momento';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  }

  private async bootstrapAccountSession(): Promise<void> {
    await this.authService.ensureSessionFresh();
    await this.validateAccountSession();
  }

  private async validateAccountSession(): Promise<void> {
    const ok = await this.authService.validateSession();
    if (!ok && !this.authService.isLoggedIn()) {
      this.errorMessage = 'Tu sesión expiró o la cuenta ya no existe. Inicia sesión de nuevo.';
    }
    void this.refreshAccountAvatar();
  }

  private async refreshAccountAvatar(): Promise<void> {
    if (!this.authService.isLoggedIn()) {
      this.authService.revokeAvatarBlob();
      this.accountAvatarUrl = null;
      return;
    }
    const user = this.authService.getUser();
    if (!user?.avatarUrl) {
      this.authService.revokeAvatarBlob();
      this.accountAvatarUrl = null;
      return;
    }
    const blob = await this.authService.loadAvatarBlobUrl(user.avatarUrl);
    this.accountAvatarUrl = blob ?? this.authService.getAvatarBlobUrl();
  }

  private checkBootSequence(): void {
    const played = sessionStorage.getItem('boot_played');
    if (played) {
      this.formReadyInstant = true;
    } else {
      this.startBootSequence();
    }
  }

  private startBootSequence(): void {
    this.showBootSequence = true;
    this.bootStep = 1; // 0s: Pantalla negra, scanline, boot text terminal
    
    this.bootTimeouts.push(setTimeout(() => {
      this.bootStep = 2; // 1.5s: Aparece Logo con efecto premium y holograma
    }, 1500));

    this.bootTimeouts.push(setTimeout(() => {
      this.bootStep = 3; // 3.0s: Typewriter título
      this.typeWriterEffect(this.fullBootText, 'displayedBootText', 1200);
    }, 3000));

    this.bootTimeouts.push(setTimeout(() => {
      this.bootStep = 4; // 4.5s: Typewriter subtítulo
      this.typeWriterEffect('[ SYSTEM INITIALIZED ]', 'displayedSubText', 500);
    }, 4500));

    this.bootTimeouts.push(setTimeout(() => {
      this.bootStep = 5; // 5.2s: Decrypting payload text
      this.typeWriterEffect('DECRYPTING PAYLOAD... 100%', 'displayedDecryptText', 600);
    }, 5200));

    this.bootTimeouts.push(setTimeout(() => {
      this.bootStep = 6; // 6.5s: Flash final cyan/verde
      this.bootFlash = true;
    }, 6500));

    this.bootTimeouts.push(setTimeout(() => {
      this.skipBootSequence(); // 7.2s: Fin de secuencia
    }, 7200));
  }

  private typeWriterEffect(text: string, targetProp: 'displayedBootText' | 'displayedSubText' | 'displayedDecryptText', duration: number): void {
    let index = 0;
    this[targetProp] = '';
    
    const intervalTime = duration / text.length;
    const interval = setInterval(() => {
      if (!this.showBootSequence) {
        clearInterval(interval);
        return;
      }
      
      this[targetProp] += text[index];
      
      index++;
      if (index === text.length) {
        clearInterval(interval);
      }
    }, intervalTime);
    this.bootTimeouts.push(interval);
  }

  skipBootSequence(): void {
    if (!this.showBootSequence) return;
    this.bootTimeouts.forEach(t => clearTimeout(t));
    this.bootTimeouts = [];
    this.showBootSequence = false;
    this.bootFlash = false;
    this.formReady = true;
    sessionStorage.setItem('boot_played', 'true');
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get loggedInUsername(): string | null {
    return this.authService.getDisplayName();
  }

  /** Con cuenta: no hace falta paso de alias manual. */
  get needsAliasStep(): boolean {
    return !this.isLoggedIn;
  }

  get activeServerUrl(): string {
    return resolveApiBase();
  }

  saveServerUrl(): void {
    setStoredApiUrl(this.serverUrlInput.trim());
    this.showServerConfig = false;
    this.errorMessage = '';
    this.socketService.reconnect();
    void this.showToast('URL del servidor guardada. Reconectando…', 'success');
  }

  openAccountPanel(): void {
    this.accountPanelAuthMode = null;
    this.showAccountPanel = true;
  }

  openAchievements(): void {
    this.router.navigate(['/achievements']);
  }

  onAccountPanelClosed(): void {
    this.showAccountPanel = false;
    this.accountPanelAuthMode = null;
  }

  private openEmailVerificationPanel(): void {
    this.accountPanelAuthMode = 'verify';
    this.showAccountPanel = true;
  }

  /** Cuentas registradas sin correo verificado no pueden unirse a salas. */
  private async guardEmailVerifiedForPlay(): Promise<boolean> {
    if (!this.authService.isLoggedIn()) return true;
    try {
      await this.authService.refreshUser();
    } catch {
      // Usar datos en caché si falla la red
    }
    if (this.authService.canPlay()) return true;
    this.errorMessage = '';
    this.openEmailVerificationPanel();
    return false;
  }

  onAuthChanged(): void {
    this.syncPlayerNameFromAccount();
    if (this.isLoggedIn) {
      this.errorMessage = '';
    }
    void this.refreshAccountAvatar();
  }

  private syncPlayerNameFromAccount(): void {
    const name = this.authService.getDisplayName();
    if (name) {
      this.playerName = name;
      localStorage.setItem('playerName', name);
    } else {
      const saved = localStorage.getItem('playerName');
      if (saved) this.playerName = saved;
    }
  }

  ngOnDestroy(): void {
    void this.qrScanner.stop();
    this.subs.unsubscribe();
  }

  get canProceedToAlias(): boolean {
    return !!this.roomCode.trim();
  }

  async goToAliasStep(): Promise<void> {
    if (!this.canProceedToAlias) {
      this.errorMessage = 'Ingresa o escanea un código de sala.';
      return;
    }
    this.roomCode = this.roomCode.toUpperCase().trim();
    this.errorMessage = '';
    this.validatingRoom = true;
    try {
      const status = await fetchRoomStatus(this.roomCode);

      if (isRoomStatusUnavailable(status)) {
        if (this.needsAliasStep) {
          this.step = 'alias';
        } else {
          if (!(await this.guardEmailVerifiedForPlay())) return;
          void this.joinNetworkAsync();
        }
        return;
      }

      if (!status.exists) {
        this.errorMessage = 'Sala no encontrada. Verifica el código o escanea el QR del host.';
        return;
      }
      if (status.phase === 'FIN') {
        this.errorMessage = 'Esta partida ya finalizó. Pide al host que cree una sala nueva.';
        return;
      }
      // Spectators can now join ongoing games, so we no longer block them here.

      if (this.needsAliasStep) {
        this.step = 'alias';
      } else {
        if (!(await this.guardEmailVerifiedForPlay())) return;
        void this.joinNetworkAsync();
      }
    } finally {
      this.validatingRoom = false;
    }
  }

  onRoomCodeChange(val: string): void {
    let cleaned = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    
    if (cleaned && !cleaned.startsWith('FIRE-') && cleaned.length > 0) {
      const prefix = 'FIRE-';
      if (!prefix.startsWith(cleaned)) {
        cleaned = 'FIRE-' + cleaned.replace(/FIRE-/g, '');
      }
    }
    
    if (cleaned.length > 9) {
      cleaned = cleaned.substring(0, 9);
    }
    
    if (cleaned === 'FIRE') {
      cleaned = 'FIRE-';
    }

    this.roomCode = cleaned;
    
    if (cleaned.length === 9) {
      this.roomValidationState = 'checking';
      this.roomValidationMessage = 'Buscando...';
      this.roomCodeSubject.next(cleaned);
    } else {
      this.roomValidationState = 'idle';
      this.roomValidationMessage = '';
      this.roomCodeSubject.next('');
    }
  }

  private async validateRoomCode(code: string): Promise<void> {
    if (!code || code.length < 9) {
      this.roomValidationState = 'idle';
      this.roomValidationMessage = '';
      return;
    }
    
    try {
      const status = await fetchRoomStatus(code);
      if (isRoomStatusUnavailable(status)) {
        this.roomValidationState = 'idle';
        this.roomValidationMessage = '';
        return;
      }
      
      if (!status.exists) {
        this.roomValidationState = 'invalid';
        this.roomValidationMessage = '✕ Sala no existe';
        this.removeRecentRoom(code);
      } else if (status.phase === 'FIN') {
        this.roomValidationState = 'invalid';
        this.roomValidationMessage = '✕ Partida finalizada';
      } else {
        this.roomValidationState = 'valid';
        const count = status.connectedCount ?? status.playerCount ?? 0;
        const max = status.maxPlayers ?? 10;
        this.roomValidationMessage = `✓ Sala encontrada · ${count}/${max}`;
      }
    } catch {
      this.roomValidationState = 'idle';
      this.roomValidationMessage = '';
    }
  }

  backToRoomStep(): void {
    this.step = 'room';
    this.errorMessage = '';
    this.roomValidationState = 'idle';
    this.roomValidationMessage = '';
  }

  async scanQr(): Promise<void> {
    if (this.scanning || this.connecting) return;
    this.scanning = true;
    this.errorMessage = '';

    const result = await this.qrScanner.scanRoomCode();
    this.scanning = false;

    if (!result.ok) {
      if (result.code === 'permission_denied') {
        await this.showToast(result.error, 'warning');
      } else if (result.code !== 'cancelled') {
        this.errorMessage = result.error;
      }
      return;
    }

    this.roomCode = result.roomCode;
    await this.goToAliasStep();
  }

  joinNetwork(): void {
    if (!this.roomCode.trim()) {
      this.errorMessage = 'Ingresa el código de sala.';
      return;
    }
    if (this.needsAliasStep && !this.playerName.trim()) {
      this.errorMessage = 'Ingresa tu alias de invitado.';
      return;
    }
    if (!this.needsAliasStep) {
      this.syncPlayerNameFromAccount();
    }

    void this.joinNetworkAsync();
  }

  reconnectToActiveGame(): void {
    if (!this.pendingReconnect) return;
    void this.reconnectToActiveGameAsync();
  }

  private async reconnectToActiveGameAsync(): Promise<void> {
    if (!(await this.guardEmailVerifiedForPlay())) return;
    this.roomCode = this.pendingReconnect!.roomId;
    this.syncPlayerNameFromAccount();
    if (this.needsAliasStep) {
      this.step = 'alias';
    }
    this.joinNetwork();
  }

  private async joinNetworkAsync(): Promise<void> {
    this.connecting = true;
    this.errorMessage = '';

    const displayName = this.needsAliasStep
      ? this.playerName.trim()
      : (this.authService.getDisplayName() ?? this.playerName.trim());

    if (!displayName) {
      this.connecting = false;
      this.errorMessage = 'Inicia sesión o ingresa un alias de invitado.';
      return;
    }

    if (!(await this.guardEmailVerifiedForPlay())) {
      this.connecting = false;
      return;
    }

    localStorage.setItem('playerName', displayName);

    const status = await fetchRoomStatus(this.roomCode);

    if (!isRoomStatusUnavailable(status)) {
      if (!status.exists) {
        this.connecting = false;
        this.errorMessage = 'La sala no existe. Verifica el código.';
        this.socketService.clearSession();
        this.pendingReconnect = null;
        return;
      }
      if (status.phase === 'FIN') {
        this.connecting = false;
        this.errorMessage = 'Esta partida ya terminó.';
        this.socketService.clearSession();
        this.pendingReconnect = null;
        return;
      }

      const existingId = localStorage.getItem('myPlayerId');
      if (!status.canJoin && !existingId) {
        this.connecting = false;
        this.errorMessage = 'La partida ya comenzó. Solo jugadores registrados pueden reconectar.';
        return;
      }
    }

    const existingId = localStorage.getItem('myPlayerId');
    const myPlayerId = existingId ?? `usr_${Math.random().toString(36).slice(2, 11)}`;
    if (!existingId) {
      localStorage.setItem('myPlayerId', myPlayerId);
    }

    if (this.authService.isLoggedIn()) {
      try {
        console.log('[DEBUG JOIN] Calling linkGuest for', myPlayerId);
        await this.authService.linkGuest(myPlayerId);
        console.log('[DEBUG JOIN] linkGuest SUCCESS');
      } catch (err) {
        console.error('[DEBUG JOIN] linkGuest FAILED:', err);
      }
    }

    this.socketService.connect();

    const joinSub = this.socketService.connected$
      .pipe(
        filter((c) => c),
        take(1),
        timeout(8000),
        catchError(() => {
          this.connecting = false;
          this.errorMessage = 'No se pudo conectar al servidor. Verifica la red.';
          return of(false);
        }),
      )
      .subscribe((ok) => {
        if (!ok) return;

        this.socketService.joinRoom(this.roomCode.toUpperCase(), myPlayerId, displayName);

        const stateSub = this.socketService.gameState$
          .pipe(take(1), timeout(6000))
          .subscribe({
            next: () => {
              this.connecting = false;
              void this.gameSound.unlockAudio();
              this.saveRecentRoom(this.roomCode.toUpperCase());
              this.transitioning = true;
              setTimeout(() => {
                this.router.navigate(['/dashboard']);
              }, 800);
            },
            error: () => {
              this.connecting = false;
              this.errorMessage = 'Sala no encontrada o sin respuesta del servidor.';
            },
          });

        const errSub = this.socketService.error$
          .pipe(take(1), timeout(6000))
          .subscribe((msg) => {
            this.connecting = false;
            const { code } = parseServerErrorMessage(msg);
            if (code === 'email_not_verified') {
              this.errorMessage = '';
              this.openEmailVerificationPanel();
            } else {
              this.errorMessage = formatServerErrorForToast(msg);
            }
          });

        this.subs.add(stateSub);
        this.subs.add(errSub);
      });

    this.subs.add(joinSub);
  }

  private async checkPendingReconnect(): Promise<void> {
    const roomId = localStorage.getItem('roomCode');
    const playerId = localStorage.getItem('myPlayerId');
    const name = localStorage.getItem('playerName');
    if (!roomId || !playerId || !name) return;

    const status = await fetchRoomStatus(roomId, playerId);

    if (isRoomStatusUnavailable(status)) {
      return;
    }

    if (!status.exists || status.phase === 'FIN' || !status.canReconnect) {
      if (!status.exists || status.phase === 'FIN') {
        this.socketService.clearSession();
      }
      this.pendingReconnect = null;
      return;
    }

    const phaseNames: Record<string, string> = {
      LOBBY: 'Lobby',
      REPARTO: 'Reparto',
      NOCHE: 'Noche',
      DIA: 'Día',
      VOTACION: 'Votación',
    };
    this.pendingReconnect = {
      roomId: roomId.toUpperCase(),
      phaseLabel: phaseNames[status.phase ?? ''] ?? status.phase ?? 'En curso',
    };
  }

  onLobbyClosedDismiss(): void {
    this.showLobbyClosedOverlay = false;
  }

  private async showToast(message: string, color: 'warning' | 'success' | 'danger' = 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 4500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
