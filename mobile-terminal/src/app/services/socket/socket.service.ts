import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket!: Socket;
  private readonly SERVER_URL = 'http://192.168.137.1:3000';

  // Transmisores reactivos para que el Dashboard los escuche
  public gameState$ = new Subject<any>();
  public playerState$ = new Subject<any>();

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    const savedSession = localStorage.getItem('playerSession');

    this.socket = io(this.SERVER_URL, {
      auth: { session: savedSession },
      transports: ['websocket'], // <-- ADICIONE ESTA LINHA
    });

    this.socket = io(this.SERVER_URL + '/game', {
      auth: { session: savedSession },
    });

    this.socket.on('roomState', (roomId: string, state: any) => {
      console.log('Recibido estado de la sala:', state);

      // Enviamos el estado general al dashboard (Fase y todos los jugadores)
      this.gameState$.next(state);

      // Buscamos MIS datos personales para saber mi ROL
      const myPlayerId = localStorage.getItem('myPlayerId');
      if (myPlayerId && state.players) {
        const myData = state.players.find((p: any) => p.id === myPlayerId);

        if (myData) {
          this.playerState$.next({
            name: myData.name,
            role: myData.role || 'ESPERANDO ASIGNACIÓN',
            isDead: !myData.isAlive,
          });
        }
      }
    });
  }

  public emitAction(action: string, ...args: any[]) {
    if (this.socket.connected) {
      this.socket.emit(action, ...args);
    } else {
      console.error('Error: Sin conexión al servidor.');
    }
  }
}
