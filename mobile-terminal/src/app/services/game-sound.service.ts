import { Injectable } from '@angular/core';
import { SOUND_FILES } from '../core/audio/sound-manifest';

export type SoundEvent = keyof typeof SOUND_FILES;

/** Eventos silenciados en NOCHE para no delatar acciones en mesa. */
const NIGHT_SILENT_EVENTS = new Set<SoundEvent>([
  'night',
  'action',
  'action_accepted',
  'skill_success',
  'skill_fail',
  'chat',
  'vote',
]);

@Injectable({ providedIn: 'root' })
export class GameSoundService {
  private muted = false;
  /** Modo sigilo: sin SFX de gameplay durante NOCHE (solo hápticos). */
  private nightSilent = false;
  private cache = new Map<string, HTMLAudioElement>();
  private ctx: AudioContext | null = null;

  setMuted(m: boolean): void {
    this.muted = m;
  }

  /** Activa/desactiva sonidos de gameplay en NOCHE (acciones, chat, skill checks). */
  setNightSilent(silent: boolean): void {
    this.nightSilent = silent;
  }

  isNightSilent(): boolean {
    return this.nightSilent;
  }

  play(event: SoundEvent): void {
    if (this.muted) return;
    if (this.nightSilent && NIGHT_SILENT_EVENTS.has(event)) return;
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
    this.play('vote');
  }

  /** Confirmación genérica al enviar acción (silenciada en NOCHE). */
  playAction(): void {
    this.play('action');
  }

  playAccepted(): void {
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

  private async playFile(path: string): Promise<boolean> {
    try {
      let audio = this.cache.get(path);
      if (!audio) {
        audio = new Audio(path);
        this.cache.set(path, audio);
      }
      audio.currentTime = 0;
      audio.volume = 0.5;
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
    };
    const t = tones[event];
    if (t) this.playTone(ctx, t[0], t[1]);
    if (event === 'game_over_system') this.playSweep(ctx, 400, 900, 0.5);
    if (event === 'game_over_hacker') this.playSweep(ctx, 900, 200, 0.5);
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
