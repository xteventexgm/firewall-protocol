import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Html5Qrcode } from 'html5-qrcode';
import { parseRoomCodeFromScan } from '../core/utils/room-code.utils';

export type QrScanResult = { ok: true; roomCode: string } | { ok: false; error: string };

@Injectable({ providedIn: 'root' })
export class QrScannerService {
  private scanner: Html5Qrcode | null = null;
  private active = false;

  async scanRoomCode(): Promise<QrScanResult> {
    if (!Capacitor.isNativePlatform() && !this.hasCameraSupport()) {
      return { ok: false, error: 'La cámara no está disponible en este navegador.' };
    }

    const elementId = 'fp-qr-reader';
    await this.ensureReaderElement(elementId);

    try {
      this.scanner = new Html5Qrcode(elementId);
      this.active = true;

      const decoded = await new Promise<string>((resolve, reject) => {
        this.scanner!
          .start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (text) => resolve(text),
            () => undefined,
          )
          .catch(reject);
      });

      const roomCode = parseRoomCodeFromScan(decoded);
      if (!roomCode) {
        return { ok: false, error: 'QR no contiene un código de sala válido (FIRE-XXXX).' };
      }
      return { ok: true, roomCode };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('notallowed') || msg.toLowerCase().includes('permission')) {
        return { ok: false, error: 'Permiso de cámara denegado. Ingresa el código manualmente.' };
      }
      return { ok: false, error: 'No se pudo escanear el QR. Intenta de nuevo.' };
    } finally {
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    if (!this.scanner || !this.active) return;
    try {
      await this.scanner.stop();
      await this.scanner.clear();
    } catch {
      /* ignore */
    }
    this.active = false;
    this.scanner = null;
    document.getElementById('fp-qr-reader')?.remove();
  }

  private hasCameraSupport(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  private async ensureReaderElement(id: string): Promise<void> {
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText =
      'position:fixed;inset:0;z-index:10000;background:#050a12ee;display:flex;align-items:center;justify-content:center;padding:1rem;';
    document.body.appendChild(el);
  }
}
