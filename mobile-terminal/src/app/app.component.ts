import { Component, OnDestroy, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
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
  private keyboardShowListener?: { remove: () => Promise<void> };
  private keyboardHideListener?: { remove: () => Promise<void> };
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

      // Keyboard show/hide listeners to adjust layout
      try {
        this.keyboardShowListener = await Keyboard.addListener('keyboardWillShow', (info) => {
          document.documentElement.classList.add('keyboard-visible');
          document.documentElement.style.setProperty(
            '--keyboard-offset',
            `${info.keyboardHeight}px`,
          );
        });
        this.keyboardHideListener = await Keyboard.addListener('keyboardWillHide', () => {
          document.documentElement.classList.remove('keyboard-visible');
          document.documentElement.style.setProperty('--keyboard-offset', '0px');
        });
      } catch {
        /* Keyboard plugin no disponible */
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
    void this.keyboardShowListener?.remove();
    void this.keyboardHideListener?.remove();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}

