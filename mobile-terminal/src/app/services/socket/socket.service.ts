import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;
  // Esta URL la cambiarán luego por la IP del Integrante 3
  private readonly SERVER_URL = 'http://localhost:3000'; 

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    // Recuperar el ID de sesión del jugador de la memoria del teléfono
    const savedSession = localStorage.getItem('playerSession');

    this.socket = io(this.SERVER_URL, {
      auth: {
        session: savedSession
      }
    });

    this.socket.on('connect', () => {
      console.log('🔗 Conectado al servidor central de Firewall Protocol');
    });

    // Guardar la nueva sesión cuando el servidor la asigne por primera vez
    this.socket.on('session-assigned', (sessionData: any) => {
      localStorage.setItem('playerSession', sessionData.token);
    });
  }

  // Método general para emitir acciones (votos, poderes, etc.)
  public emitAction(action: string, payload: any) {
    if (this.socket.connected) {
      this.socket.emit(action, payload);
    } else {
      console.error('Error: Sin conexión al servidor.');
    }
  }
}