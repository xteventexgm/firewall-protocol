import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router'; // Importamos el Router
import { SocketService } from '../../services/socket/socket.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule],
})
export class LoginPage {
  roomCode: string = '';
  playerName: string = '';

  // Inyectamos el Router en el constructor
  constructor(
    private socketService: SocketService,
    private router: Router,
  ) {}

  joinNetwork() {
    if (this.roomCode.trim() && this.playerName.trim()) {
      const myPlayerId = 'usr_' + Math.random().toString(36).substr(2, 9);

      // 1. Guardamos el ID en memoria para que el SocketService lo pueda leer luego
      localStorage.setItem('myPlayerId', myPlayerId);

      this.socketService.emitAction(
        'joinRoom',
        this.roomCode.toUpperCase(),
        myPlayerId,
        this.playerName,
      );

      this.router.navigate(['/dashboard']);
    } else {
      console.warn('[WARN] Faltan credenciales.');
    }
  }
}
