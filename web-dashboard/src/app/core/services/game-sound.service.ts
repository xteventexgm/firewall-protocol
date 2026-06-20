import { Injectable } from '@angular/core';
import { SOUND_FILES } from '../audio/sound-manifest';

export type SoundEvent =
  | 'lobby'
  | 'game_start'
  | 'night'
  | 'day'
  | 'vote'
  | 'kill'
  | 'action'
  | 'action_accepted'
  | 'incident'
  | 'game_over_system'
  | 'game_over_hacker'
  | 'game_over_solo'
  | 'warning'
  | 'chat'
  | 'role_reveal'
  | 'death'
  | 'ui_click'
  | 'ui_confirm'
  | 'skill_success'
  | 'skill_fail'
  | 'lobby_ambient'
  | 'night_ambient'
  | 'defeat';

type AmbientMode = 'lobby' | 'night' | null;

const STOPS_AMBIENT = new Set<SoundEvent>([
  'day',
  'game_start',
  'game_over_system',
  'game_over_hacker',
  'game_over_solo',
  'defeat',
]);

@Injectable({ providedIn: 'root' })
export class GameSoundService {
  private muted = false;
  private cache = new Map<string, HTMLAudioElement>();
  private ambientAudio: HTMLAudioElement | null = null;
  private activeAmbient: AmbientMode = null;
  private ctx: AudioContext | null = null;
  private ambienceOsc: OscillatorNode | null = null;
  private ambienceGain: GainNode | null = null;

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.stopAmbient();
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Loop de lobby (pantalla inicio o sala en fase LOBBY). */
  startLobbyAmbient(): void {
    if (this.muted) return;
    if (this.activeAmbient === 'lobby') return;
    const path = SOUND_FILES['lobby_ambient'];
    if (typeof path === 'string') {
      void this.playAmbientFile(path, 'lobby', 0.14);
      return;
    }
    this.playProceduralAmbient('lobby');
  }

  /** Loop nocturno (fase NOCHE). */
  startNightAmbient(): void {
    if (this.muted) return;
    if (this.activeAmbient === 'night') return;
    const path = SOUND_FILES['night_ambient'];
    if (typeof path === 'string') {
      void this.playAmbientFile(path, 'night', 0.12);
      return;
    }
    this.playProceduralAmbient('night');
  }

  stopAmbient(): void {
    this.stopAmbience();
    this.activeAmbient = null;
  }

  /** Transición a noche: sting + ambiente. */
  enterNightPhase(): void {
    if (this.muted) return;
    void this.playOneShot(this.resolvePath('night', 0), 0.42);
    this.startNightAmbient();
  }

  /** Transición a día: corta ambiente + sting. */
  enterDayPhase(): void {
    if (this.muted) return;
    this.stopAmbient();
    void this.playOneShot(this.resolvePath('day'), 0.4);
  }

  play(event: SoundEvent): void {
    if (this.muted) return;

    if (event === 'lobby_ambient') {
      this.startLobbyAmbient();
      return;
    }
    if (event === 'night_ambient') {
      this.startNightAmbient();
      return;
    }
    if (event === 'night') {
      this.enterNightPhase();
      return;
    }
    if (event === 'day') {
      this.enterDayPhase();
      return;
    }

    if (STOPS_AMBIENT.has(event)) {
      this.stopAmbient();
    }

    const paths = SOUND_FILES[event];
    if (paths) {
      const list = Array.isArray(paths) ? paths : [paths];
      void this.playOneShots(list);
      return;
    }
    this.playProcedural(event);
  }

  playUi(kind: 'click' | 'confirm'): void {
    this.play(kind === 'click' ? 'ui_click' : 'ui_confirm');
  }

  private resolvePath(event: SoundEvent, index = 0): string {
    const paths = SOUND_FILES[event];
    if (!paths) return '';
    const list = Array.isArray(paths) ? paths : [paths];
    return list[index] ?? list[0] ?? '';
  }

  private async playOneShots(paths: string[]): Promise<void> {
    for (const path of paths) {
      if (path.includes('/ambient/')) continue;
      const ok = await this.playOneShot(path, 0.45);
      if (ok) return;
    }
  }

  private async playOneShot(path: string, volume: number): Promise<boolean> {
    if (!path || path.includes('/ambient/')) return false;
    try {
      let audio = this.cache.get(path);
      if (!audio) {
        audio = new Audio(path);
        audio.preload = 'auto';
        this.cache.set(path, audio);
      }
      audio.loop = false;
      audio.volume = volume;
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  private async playAmbientFile(path: string, mode: AmbientMode, volume: number): Promise<void> {
    try {
      let audio = this.cache.get(path);
      if (!audio) {
        audio = new Audio(path);
        audio.preload = 'auto';
        this.cache.set(path, audio);
      }
      this.stopAmbience();
      this.ambientAudio = audio;
      this.activeAmbient = mode;
      audio.loop = true;
      audio.volume = volume;
      audio.currentTime = 0;
      await audio.play();
    } catch {
      this.playProceduralAmbient(mode);
    }
  }

  private playProceduralAmbient(mode: AmbientMode): void {
    if (!mode) return;
    this.stopAmbience();
    this.activeAmbient = mode;
    this.startProceduralAmbience(this.ensureCtx());
  }

  private playProcedural(event: SoundEvent): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    switch (event) {
      case 'lobby':
      case 'ui_click':
        this.playTone(ctx, 220, 0.08, 'sine', 0.04);
        break;
      case 'ui_confirm':
      case 'action_accepted':
      case 'skill_success':
        this.playTone(ctx, 520, 0.1, 'sine', 0.05);
        break;
      case 'game_start':
      case 'role_reveal':
        this.playSweep(ctx, 200, 800, 0.4);
        break;
      case 'vote':
        this.playTone(ctx, 520, 0.06, 'square', 0.03);
        break;
      case 'kill':
      case 'incident':
      case 'death':
        this.playNoiseBurst(ctx, 0.2);
        this.playTone(ctx, 120, 0.25, 'sawtooth', 0.08);
        break;
      case 'action':
        this.playTone(ctx, 400, 0.08, 'sine', 0.04);
        break;
      case 'warning':
      case 'skill_fail':
        this.playTone(ctx, 440, 0.1, 'square', 0.05);
        setTimeout(() => this.playTone(ctx, 330, 0.1, 'square', 0.04), 120);
        break;
      case 'chat':
        this.playTone(ctx, 700, 0.04, 'sine', 0.02);
        break;
      case 'game_over_system':
        this.stopAmbient();
        this.playSweep(ctx, 400, 900, 0.6);
        break;
      case 'game_over_hacker':
        this.stopAmbient();
        this.playNoiseBurst(ctx, 0.3);
        this.playSweep(ctx, 900, 200, 0.5);
        break;
      case 'game_over_solo':
        this.stopAmbient();
        this.playTone(ctx, 200, 0.4, 'sawtooth', 0.07);
        break;
      case 'defeat':
        this.stopAmbient();
        this.playTone(ctx, 90, 0.5, 'sawtooth', 0.06);
        break;
    }
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

  private playTone(ctx: AudioContext, freq: number, duration: number, type: OscillatorType, volume: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
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
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playNoiseBurst(ctx: AudioContext, duration: number): void {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  private startProceduralAmbience(ctx: AudioContext | null): void {
    if (!ctx) return;
    this.ambienceOsc = ctx.createOscillator();
    this.ambienceGain = ctx.createGain();
    this.ambienceOsc.type = 'sine';
    this.ambienceOsc.frequency.value = this.activeAmbient === 'night' ? 55 : 72;
    this.ambienceGain.gain.value = this.activeAmbient === 'night' ? 0.015 : 0.012;
    this.ambienceOsc.connect(this.ambienceGain);
    this.ambienceGain.connect(ctx.destination);
    this.ambienceOsc.start();
  }

  private stopAmbience(): void {
    try {
      this.ambientAudio?.pause();
    } catch { /* noop */ }
    this.ambientAudio = null;
    try {
      this.ambienceOsc?.stop();
    } catch { /* noop */ }
    this.ambienceOsc = null;
    this.ambienceGain = null;
  }
}
