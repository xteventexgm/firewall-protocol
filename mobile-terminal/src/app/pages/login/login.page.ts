import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SocketService } from '../../services/socket/socket.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true, // ¡Aseguramos que es standalone!
  imports: [IonicModule, FormsModule] // Importamos FormsModule aquí para que ngModel funcione
})
export class LoginPage {
  roomCode: string = '';
  playerName: string = '';

  constructor(private socketService: SocketService) {}

  joinNetwork() {
    if (this.roomCode.trim() && this.playerName.trim()) {
      console.log(`[SYS] Iniciando conexión segura a la red: ${this.roomCode}`);
      
      this.socketService.emitAction('join-room', {
        room: this.roomCode.toUpperCase(),
        player: this.playerName
      });

    } else {
      console.warn('[WARN] Faltan credenciales de acceso.');
    }
  }
}