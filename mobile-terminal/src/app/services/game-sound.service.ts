import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SOUND_FILES } from '../core/audio/sound-manifest';

export type SoundEvent = keyof typeof SOUND_FILES;

/** Eventos permitidos aun en modo noche/discreto (solo fin de partida). */
const DISCRETE_ALLOWED = new Set<SoundEvent>([
  'game_over_system',
  'game_over_hacker',
  'game_over_solo',
  'defeat',
]);

/** Eventos silenciados en NOCHE si el usuario activó sonido. */
const NIGHT_SILENT_EVENTS = new Set<SoundEvent>([
  'game_start',
  'action',
  'action_accepted',
  'skill_success',
  'skill_fail',
  'chat',
  'vote',
  'role_reveal',
  'death',
  'kill',
  'incident',
]);

/**
 * Audio móvil: silenciado por defecto (terminal anónima en mesa).
 * Con sonido off, vibración ligera en acciones clave.
 */
@Injectable({ providedIn: 'root' })
export class GameSoundService {
  private muted = true;
  private nightSilent = true;
  private cache = new Map<string, HTMLAudioElement>();
  private ctx: AudioContext | null = null;
  private unlocked = false;

  setMuted(m: boolean): void {
    this.muted = m;
  }

  setNightSilent(silent: boolean): void {
    this.nightSilent = silent;
  }

  isNightSilent(): boolean {
    return this.nightSilent;
  }

  /** Desbloquea audio tras gesto del usuario (política autoplay móvil). */
  async unlockAudio(): Promise<void> {
    if (this.unlocked) return;
    const ctx = this.ensureCtx();
    if (ctx?.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    try {
      const probe = this.getAudio('/assets/sfx/ui/button-click.mp3');
      probe.volume = 0.001;
      await probe.play();
      probe.pause();
      probe.currentTime = 0;
      this.unlocked = true;
    } catch {
      /* primer gesto puede fallar; reintentar en siguiente interacción */
    }
  }

  play(event: SoundEvent): void {
    if (this.muted) return;
    if (this.nightSilent && NIGHT_SILENT_EVENTS.has(event) && !DISCRETE_ALLOWED.has(event)) return;
    void this.unlockAudio();
    const path = SOUND_FILES[event];
    if (path && typeof path === 'string') {
      void this.playFile(path).then((ok) => {
        if (!ok) this.playProcedural(event);
      });
      return;
    }
    this.playProcedural(event);
  }

  playDay(): void {
    this.play('day');
  }

  playVote(): void {
    if (this.muted) {
      void this.haptic(ImpactStyle.Medium);
      return;
    }
    this.play('vote');
  }

  playAction(): void {
    if (this.muted) {
      void this.haptic(ImpactStyle.Light);
      return;
    }
    this.play('action');
  }

  playAccepted(): void {
    if (this.muted) {
      void this.haptic(ImpactStyle.Medium);
      return;
    }
    this.play('action_accepted');
  }

  playChat(): void {
    this.play('chat');
  }

  playRoleReveal(): void {
    this.play('role_reveal');
  }

  playDeath(): void {
    this.play('death');
  }

  private async haptic(style: ImpactStyle): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style });
    } catch {
      /* noop */
    }
  }

  private getAudio(path: string): HTMLAudioElement {
    let audio = this.cache.get(path);
    if (!audio) {
      audio = new Audio(path);
      audio.preload = 'auto';
      this.cache.set(path, audio);
    }
    return audio;
  }

  private async playFile(path: string): Promise<boolean> {
    try {
      const audio = new Audio(path);
      audio.volume = 1.0;
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  private playProcedural(event: SoundEvent): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const tones: Partial<Record<SoundEvent, [number, number]>> = {
      day: [600, 0.15],
      vote: [440, 0.07],
      action: [640, 0.05],
      action_accepted: [520, 0.08],
      death: [120, 0.3],
      role_reveal: [500, 0.2],
      chat: [700, 0.04],
      skill_fail: [330, 0.12],
      ui_click: [800, 0.03],
    };
    const t = tones[event];
    if (t) this.playTone(ctx, t[0], t[1]);
    if (event === 'ui_confirm') this.playSweep(ctx, 400, 800, 0.15);
    if (event === 'scan_safe') this.playSweep(ctx, 500, 1000, 0.3);
    if (event === 'scan_malicious') this.playSweep(ctx, 300, 150, 0.4);
    if (event === 'vote_tie') {
      this.playTone(ctx, 350, 0.2);
      setTimeout(() => this.playTone(ctx!, 300, 0.3), 150);
    }
    if (event === 'game_over_system') this.playSweep(ctx, 400, 900, 0.5);
    if (event === 'game_over_hacker') this.playSweep(ctx, 900, 200, 0.5);
    if (event === 'game_over_solo') this.playTone(ctx, 200, 0.35);
    if (event === 'defeat') this.playTone(ctx, 90, 0.4);
  }

  private ensureCtx(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private playTone(ctx: AudioContext, freq: number, duration: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playSweep(ctx: AudioContext, from: number, to: number, duration: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }
}
