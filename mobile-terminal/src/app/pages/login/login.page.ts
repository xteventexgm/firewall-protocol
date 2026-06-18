import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { SocketService } from '../../services/socket/socket.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule],
})
export class LoginPage {
  roomCode = '';
  playerName = '';

  constructor(
    private socketService: SocketService,
    private router: Router,
  ) {}

  joinNetwork(): void {
    if (!this.roomCode.trim() || !this.playerName.trim()) {
      console.warn('[WARN] Faltan credenciales.');
      return;
    }

    const existingId = localStorage.getItem('myPlayerId');
    const myPlayerId = existingId ?? `usr_${Math.random().toString(36).slice(2, 11)}`;

    this.socketService.joinRoom(
      this.roomCode.toUpperCase(),
      myPlayerId,
      this.playerName.trim(),
    );

    this.router.navigate(['/dashboard']);
  }
}
