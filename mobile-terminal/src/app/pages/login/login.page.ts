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
  imports: [IonicModule, FormsModule]
})
export class LoginPage {
  roomCode: string = '';
  playerName: string = '';

  // Inyectamos el Router en el constructor
  constructor(private socketService: SocketService, private router: Router) {}

  joinNetwork() {
    if (this.roomCode.trim() && this.playerName.trim()) {
      console.log(`[SYS] Iniciando conexión segura a la red: ${this.roomCode}`);
      
      this.socketService.emitAction('join-room', {
        room: this.roomCode.toUpperCase(),
        player: this.playerName
      });

      // Redirigimos al jugador al dashboard
      this.router.navigate(['/dashboard']);

    } else {
      console.warn('[WARN] Faltan credenciales de acceso.');
    }
  }
}