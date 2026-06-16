import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common'; // Necesario para *ngIf y *ngFor

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule]
})
export class DashboardPage implements OnInit {
  // Variables simuladas que luego llenaremos con WebSockets y LocalStorage
  playerName: string = 'ZeroCool';
  playerRole: string = 'Analista SOC';
  gamePhase: 'LOBBY' | 'NIGHT' | 'DAY' = 'NIGHT';
  
  // Lista de jugadores vivos para el combo-box
  alivePlayers: string[] = ['AcidBurn', 'CrashOverride', 'LordNikon', 'PhantomFreak'];
  selectedTarget: string = '';

  constructor() {}

  ngOnInit() {
    // Aquí luego recuperaremos el estado al cargar la página
  }

  // Se ejecuta solo al presionar el botón, nunca al cambiar el combo-box accidentalmente
  executeAction() {
    if (this.selectedTarget) {
      console.log(`[ACCIÓN] Ejecutando comando sobre: ${this.selectedTarget}`);
      // Aquí enviaremos la acción por WebSocket
      this.selectedTarget = ''; // Limpiamos la selección
    }
  }
}