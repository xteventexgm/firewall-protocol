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
import { GameSoundService } from '../../services/game-sound.service';
import { fetchRoomStatus, isRoomStatusUnavailable } from '../../core/utils/room-status.utils';
import { Subscription, filter, take, timeout, catchError, of } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule, LobbyClosedOverlayComponent, HomeAtmosphereComponent],
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

  private subs = new Subscription();

  constructor(
    private socketService: SocketService,
    private qrScanner: QrScannerService,
    private router: Router,
    private route: ActivatedRoute,
    private toastController: ToastController,
    private gameSound: GameSoundService,
  ) {
    this.subs.add(
      this.socketService.connected$.subscribe((c) => {
        this.connected = c;
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
    const savedName = localStorage.getItem('playerName');
    if (savedName) this.playerName = savedName;

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
        this.step = 'alias';
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

      this.step = 'alias';
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
    this.step = 'alias';
  }

  joinNetwork(): void {
    if (!this.roomCode.trim() || !this.playerName.trim()) {
      this.errorMessage = 'Completa el código de sala y tu alias.';
      return;
    }

    void this.joinNetworkAsync();
  }

  reconnectToActiveGame(): void {
    if (!this.pendingReconnect) return;
    this.roomCode = this.pendingReconnect.roomId;
    const savedName = localStorage.getItem('playerName');
    if (savedName) this.playerName = savedName;
    this.step = 'alias';
    this.joinNetwork();
  }

  private async joinNetworkAsync(): Promise<void> {
    this.connecting = true;
    this.errorMessage = '';

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

        this.socketService.joinRoom(
          this.roomCode.toUpperCase(),
          myPlayerId,
          this.playerName.trim(),
        );

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
