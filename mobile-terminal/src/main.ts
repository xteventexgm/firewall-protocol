import { importProvidersFrom } from '@angular/core';
import { LucideAngularModule, ShieldCheck, Skull, Zap, Moon, Sun, BoxSelect, CheckCircle, Wifi, WifiOff, Heart, Volume2, VolumeX, LogOut, Copy, Activity, Server, Users, Terminal, Ghost, Info, AlertTriangle, LogIn, Lock, User, X, SkipForward, TerminalSquare, Shuffle, Vote, Search, Smartphone, ChevronLeft, ChevronRight, BookOpen, Repeat, Star, ChevronUp, ChevronDown, Trophy } from 'lucide-angular';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(LucideAngularModule.pick({ ShieldCheck, Skull, Zap, Moon, Sun, BoxSelect, CheckCircle, Wifi, WifiOff, Heart, Volume2, VolumeX, LogOut, Copy, Activity, Server, Users, Terminal, Ghost, Info, AlertTriangle, LogIn, Lock, User, X, SkipForward, TerminalSquare, Shuffle, Vote, Search, Smartphone, ChevronLeft, ChevronRight, BookOpen, Repeat, Star, ChevronUp, ChevronDown, Trophy })),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});