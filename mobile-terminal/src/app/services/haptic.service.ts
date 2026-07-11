import { Injectable } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Injectable({
  providedIn: 'root'
})
export class HapticService {
  private enabled = true;

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    const stored = localStorage.getItem('haptics_enabled');
    if (stored !== null) {
      this.enabled = stored === 'true';
    }
  }

  toggleHaptics(enable: boolean) {
    this.enabled = enable;
    localStorage.setItem('haptics_enabled', String(enable));
  }

  isHapticsEnabled(): boolean {
    return this.enabled;
  }

  private async sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  async playConfirm() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }

  async playError() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.sleep(50);
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  }

  async playConnectionError() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.sleep(100);
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }

  async playPhaseTransition() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.sleep(300);
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  }

  async playScanSafe() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }

  async playScanMalicious() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.sleep(200);
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.sleep(100);
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }

  async playDeath() {
    if (!this.enabled) return;
    try {
      await Haptics.vibrate({ duration: 750 });
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}
  }

  async playVictory() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      await this.sleep(100);
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.sleep(100);
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}
  }

  async playDefeat() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.sleep(250);
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.sleep(250);
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }

  async playNewChat() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }

  async playVoteConfirmed() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await this.sleep(150);
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  }

  async playTap() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }

  async playTimerTick() {
    if (!this.enabled) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
      await this.sleep(100);
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  }
}
