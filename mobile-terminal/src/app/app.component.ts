import { Component, OnDestroy, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit, OnDestroy {
  private resumeListener?: { remove: () => Promise<void> };
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      void this.authService.ensureSessionFresh();
    }
  };

  constructor(private authService: AuthService) {}

  async ngOnInit(): Promise<void> {
    void this.authService.ensureSessionFresh();

    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add('immersive-native');

      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setBackgroundColor({ color: '#00000000' });
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        /* StatusBar no disponible */
      }

      this.resumeListener = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void this.authService.ensureSessionFresh();
      });
    } else {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    void this.resumeListener?.remove();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
