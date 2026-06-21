import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Html5Qrcode } from 'html5-qrcode';
import { parseRoomCodeFromScan } from '../core/utils/room-code.utils';

export type QrScanErrorCode =
  | 'permission_denied'
  | 'camera_unavailable'
  | 'invalid_qr'
  | 'scan_failed'
  | 'cancelled';

export type QrScanResult =
  | { ok: true; roomCode: string }
  | { ok: false; error: string; code: QrScanErrorCode };

@Injectable({ providedIn: 'root' })
export class QrScannerService {
  private scanner: Html5Qrcode | null = null;
  private active = false;
  private cancelRequested = false;

  async scanRoomCode(): Promise<QrScanResult> {
    this.cancelRequested = false;

    const permission = await this.ensureCameraPermission();
    if (permission === 'denied') {
      return {
        ok: false,
        code: 'permission_denied',
        error: 'Permiso de cámara denegado. Ingresa el código manualmente.',
      };
    }
    if (permission === 'unavailable') {
      return {
        ok: false,
        code: 'camera_unavailable',
        error: 'La cámara no está disponible en este dispositivo.',
      };
    }

    const elementId = 'fp-qr-reader';
    const viewportId = await this.ensureReaderElement(elementId);

    try {
      this.scanner = new Html5Qrcode(viewportId);
      this.active = true;

      const decoded = await new Promise<string>((resolve, reject) => {
        const onCancel = () => reject(new Error('SCAN_CANCELLED'));
        const cancelBtn = document.getElementById('fp-qr-cancel');
        cancelBtn?.addEventListener('click', onCancel, { once: true });

        this.scanner!
          .start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (text) => resolve(text),
            () => undefined,
          )
          .catch(reject);
      });

      if (this.cancelRequested) {
        return { ok: false, code: 'cancelled', error: 'Escaneo cancelado.' };
      }

      const roomCode = parseRoomCodeFromScan(decoded);
      if (!roomCode) {
        return {
          ok: false,
          code: 'invalid_qr',
          error: 'QR no contiene un código de sala válido (FIRE-XXXX).',
        };
      }
      return { ok: true, roomCode };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'SCAN_CANCELLED' || this.cancelRequested) {
        return { ok: false, code: 'cancelled', error: 'Escaneo cancelado.' };
      }
      const lower = msg.toLowerCase();
      if (
        lower.includes('notallowed') ||
        lower.includes('permission') ||
        lower.includes('denied')
      ) {
        return {
          ok: false,
          code: 'permission_denied',
          error: 'Permiso de cámara denegado. Ingresa el código manualmente.',
        };
      }
      return {
        ok: false,
        code: 'scan_failed',
        error: 'No se pudo escanear el QR. Intenta de nuevo.',
      };
    } finally {
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    this.cancelRequested = true;
    document.getElementById('fp-qr-cancel')?.remove();
    if (this.scanner && this.active) {
      try {
        await this.scanner.stop();
        await this.scanner.clear();
      } catch {
        /* ignore stop errors */
      }
    }
    this.active = false;
    this.scanner = null;
    document.getElementById('fp-qr-reader')?.remove();
  }

  private async ensureCameraPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
    if (Capacitor.isNativePlatform()) {
      try {
        const current = await Camera.checkPermissions();
        if (current.camera === 'granted') return 'granted';
        if (current.camera === 'denied') return 'denied';

        const requested = await Camera.requestPermissions({ permissions: ['camera'] });
        if (requested.camera === 'granted') return 'granted';
        return 'denied';
      } catch {
        return 'unavailable';
      }
    }

    if (!this.hasCameraSupport()) {
      return 'unavailable';
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((t) => t.stop());
      return 'granted';
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return 'denied';
      }
      return 'unavailable';
    }
  }

  private hasCameraSupport(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  private async ensureReaderElement(id: string): Promise<string> {
    document.getElementById(id)?.remove();
    document.getElementById('fp-qr-cancel')?.remove();

    const viewportId = `${id}-viewport`;
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.style.cssText =
      'position:fixed;inset:0;z-index:10000;background:#050a12f2;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;gap:1rem;';

    const reader = document.createElement('div');
    reader.id = viewportId;
    reader.style.cssText = 'width:min(100%,320px);';

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'fp-qr-cancel';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.cssText =
      'min-height:48px;padding:0.75rem 1.5rem;border:1px solid #00f0ff55;border-radius:8px;background:#00f0ff11;color:#00f0ff;font-family:monospace;font-size:0.85rem;cursor:pointer;';
    cancelBtn.addEventListener('click', () => {
      this.cancelRequested = true;
      void this.stop();
    });

    wrapper.appendChild(reader);
    wrapper.appendChild(cancelBtn);
    document.body.appendChild(wrapper);

    return viewportId;
  }
}
