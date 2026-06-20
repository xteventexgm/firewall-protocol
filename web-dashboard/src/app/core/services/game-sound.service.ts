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
  | 'skill_fail';

@Injectable({ providedIn: 'root' })
export class GameSoundService {
  private muted = false;
  private cache = new Map<string, HTMLAudioElement>();
  private ambientAudio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private ambienceOsc: OscillatorNode | null = null;
  private ambienceGain: GainNode | null = null;

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.stopAmbience();
  }

  isMuted(): boolean {
    return this.muted;
  }

  play(event: SoundEvent): void {
    if (this.muted) return;
    const paths = SOUND_FILES[event];
    if (paths) {
      const list = Array.isArray(paths) ? paths : [paths];
      void this.playFiles(list, event);
      return;
    }
    this.playProcedural(event);
  }

  playUi(kind: 'click' | 'confirm'): void {
    this.play(kind === 'click' ? 'ui_click' : 'ui_confirm');
  }

  private async playFiles(paths: string[], event: SoundEvent): Promise<void> {
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const isLoop = path.includes('ambient/') || (event === 'night' && path.includes('night-loop'));
      const ok = await this.playFile(path, isLoop, isLoop ? 0.12 : 0.45);
      if (ok && !isLoop) return;
      if (ok && isLoop) return;
    }
    this.playProcedural(event);
  }

  private async playFile(path: string, loop: boolean, volume: number): Promise<boolean> {
    try {
      let audio = this.cache.get(path);
      if (!audio) {
        audio = new Audio(path);
        audio.preload = 'auto';
        this.cache.set(path, audio);
      }
      if (loop) {
        this.stopAmbience();
        this.ambientAudio = audio;
      }
      audio.loop = loop;
      audio.volume = volume;
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      return false;
    }
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
      case 'night':
        this.startProceduralAmbience(ctx);
        this.playTone(ctx, 80, 0.3, 'sawtooth', 0.06);
        break;
      case 'day':
        this.stopAmbience();
        this.playSweep(ctx, 300, 600, 0.25);
        this.playTone(ctx, 880, 0.15, 'sine', 0.05);
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
        this.stopAmbience();
        this.playSweep(ctx, 400, 900, 0.6);
        break;
      case 'game_over_hacker':
        this.stopAmbience();
        this.playNoiseBurst(ctx, 0.3);
        this.playSweep(ctx, 900, 200, 0.5);
        break;
      case 'game_over_solo':
        this.stopAmbience();
        this.playTone(ctx, 200, 0.4, 'sawtooth', 0.07);
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

  private startProceduralAmbience(ctx: AudioContext): void {
    this.stopAmbience();
    this.ambienceOsc = ctx.createOscillator();
    this.ambienceGain = ctx.createGain();
    this.ambienceOsc.type = 'sine';
    this.ambienceOsc.frequency.value = 55;
    this.ambienceGain.gain.value = 0.015;
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
