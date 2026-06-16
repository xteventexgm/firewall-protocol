import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;
  private readonly SERVER_URL = 'http://localhost:3000';

  // Transmisores reactivos para que el Dashboard los escuche
  public gameState$ = new Subject<any>();
  public playerState$ = new Subject<any>();

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    const savedSession = localStorage.getItem('playerSession');

    this.socket = io(this.SERVER_URL, {
      auth: { session: savedSession }
    });

    this.socket.on('connect', () => {
      console.log('🔗 Conectado al servidor central');
    });

    this.socket.on('session-assigned', (sessionData: any) => {
      localStorage.setItem('playerSession', sessionData.token);
    });

    // 1. Escucha cambios generales (Noche, Día, lista de vivos)
    this.socket.on('game-state-update', (data: any) => {
      this.gameState$.next(data);
    });

    // 2. Escucha cambios personales (Qué rol te tocó, si fuiste eliminado)
    this.socket.on('player-state-update', (data: any) => {
      this.playerState$.next(data);
    });
  }

  public emitAction(action: string, payload: any) {
    if (this.socket.connected) {
      this.socket.emit(action, payload);
    } else {
      console.error('Error: Sin conexión al servidor.');
    }
  }
}