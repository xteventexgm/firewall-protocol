import { importProvidersFrom } from '@angular/core';
import { LucideAngularModule, ShieldCheck, Skull, Zap, Moon, Sun, BoxSelect, CheckCircle, Wifi, WifiOff, Heart, Volume2, VolumeX, LogOut, Copy, Activity, Server, Users, Terminal, Ghost, Info, AlertTriangle, LogIn, Lock, User, X } from 'lucide-angular';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(LucideAngularModule.pick({ ShieldCheck, Skull, Zap, Moon, Sun, BoxSelect, CheckCircle, Wifi, WifiOff, Heart, Volume2, VolumeX, LogOut, Copy, Activity, Server, Users, Terminal, Ghost, Info, AlertTriangle, LogIn, Lock, User, X })),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimations(),
  ],
};
