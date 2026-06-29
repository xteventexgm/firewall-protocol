import { Component, OnDestroy, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth/auth.service';

import { Platform, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit, OnDestroy {
  private resumeListener?: { remove: () => Promise<void> };
  private lastBackPress = 0;
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      void this.authService.ensureSessionFresh();
    }
  };

  constructor(
    private authService: AuthService,
    private platform: Platform,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    this.platform.backButton.subscribeWithPriority(10, async (processNextHandler) => {
      // If we are in the dashboard, don't exit the app, let the dashboard's own back button handler do its thing (priority 999)
      if (this.router.url.includes('/dashboard')) {
        processNextHandler();
        return;
      }

      const now = Date.now();
      if (now - this.lastBackPress < 2000) {
        App.exitApp();
      } else {
        this.lastBackPress = now;
        const toast = await this.toastCtrl.create({
          message: 'Pulsa de nuevo para salir',
          duration: 2000,
          position: 'bottom',
          color: 'dark'
        });
        await toast.present();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    void this.authService.ensureSessionFresh();

    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add('immersive-native');

      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.hide();
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
