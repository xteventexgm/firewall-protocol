import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket/socket.service';
import { Subscription, filter, take, timeout, catchError, of, race } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule],
})
export class LoginPage implements OnInit, OnDestroy {
  roomCode = '';
  playerName = '';
  connecting = false;
  connected = false;
  errorMessage = '';

  private subs = new Subscription();

  constructor(
    private socketService: SocketService,
    private router: Router,
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
    this.socketService.connect();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  joinNetwork(): void {
    if (!this.roomCode.trim() || !this.playerName.trim()) {
      this.errorMessage = 'Completa el código de sala y tu nombre.';
      return;
    }

    this.connecting = true;
    this.errorMessage = '';

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

        const code = this.roomCode.toUpperCase().trim();

        const resultSub = race(
          this.socketService.gameState$.pipe(
            filter((s) => !!s && s.roomId === code),
            take(1),
          ),
          this.socketService.error$.pipe(take(1)),
        )
          .pipe(timeout(6000))
          .subscribe({
            next: (result) => {
              this.connecting = false;
              if (typeof result === 'string') {
                this.errorMessage = result;
                return;
              }
              this.router.navigate(['/dashboard']);
            },
            error: () => {
              this.connecting = false;
              this.errorMessage = 'Sala no encontrada o sin respuesta del servidor.';
            },
          });

        this.subs.add(resultSub);

        this.socketService.joinRoom(code, myPlayerId, this.playerName.trim());
      });

    this.subs.add(joinSub);
  }
}
