import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SocketService } from '../../services/socket/socket.service';
import { QrScannerService } from '../../services/qr-scanner.service';
import { formatServerErrorForToast } from '../../core/utils/error.utils';
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
import { Subscription, filter, take, timeout, catchError, of } from 'rxjs';

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
  accountAvatarUrl: string | null = null;
  showServerConfig = false;
  serverUrlInput = '';

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

    this.socketService.connect();
    void this.checkPendingReconnect();
    void this.refreshAccountAvatar();
    if (this.isLoggedIn) void this.bootstrapAccountSession();
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
    this.accountAvatarUrl = await this.authService.loadAvatarBlobUrl(user.avatarUrl);
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
    this.showAccountPanel = true;
  }

  onAccountPanelClosed(): void {
    this.showAccountPanel = false;
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
      const savedPlayerId = localStorage.getItem('myPlayerId');
      if (!status.canJoin && !savedPlayerId) {
        this.errorMessage = 'La partida ya comenzó. Solo jugadores registrados pueden reconectar.';
        return;
      }

      if (this.needsAliasStep) {
        this.step = 'alias';
      } else {
        void this.joinNetworkAsync();
      }
    } finally {
      this.validatingRoom = false;
    }
  }

  backToRoomStep(): void {
    this.step = 'room';
    this.errorMessage = '';
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
    this.roomCode = this.pendingReconnect.roomId;
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
        await this.authService.linkGuest(myPlayerId);
      } catch {
        // No bloquea el join
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
              this.router.navigate(['/dashboard']);
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
            this.errorMessage = formatServerErrorForToast(msg);
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
