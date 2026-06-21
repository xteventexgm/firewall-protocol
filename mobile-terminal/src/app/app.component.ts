import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  async ngOnInit(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    document.documentElement.classList.add('immersive-native');

    try {
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setBackgroundColor({ color: '#00000000' });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {
      /* StatusBar no disponible */
    }
  }
}
