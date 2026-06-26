import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

const STORAGE_KEY = 'fp_deviceLabel';
let cachedLabel: string | null = null;

/** Etiqueta legible del dispositivo (p. ej. "Tecno Spark 20", "Infinix Hot 12"). */
export async function getDeviceLabel(): Promise<string> {
  if (cachedLabel) return cachedLabel;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    cachedLabel = stored;
    return stored;
  }

  const label = await resolveDeviceLabel();
  cachedLabel = label;
  localStorage.setItem(STORAGE_KEY, label);
  return label;
}

async function resolveDeviceLabel(): Promise<string> {
  try {
    const info = await Device.getInfo();
    const manufacturer = cleanPart(info.manufacturer);
    const model = cleanPart(info.model);
    const name = cleanPart(info.name);

    if (manufacturer && model) {
      if (model.toLowerCase().startsWith(manufacturer.toLowerCase())) return model;
      return `${manufacturer} ${model}`;
    }
    if (model && model !== 'unknown') return model;
    if (manufacturer) return manufacturer;
    if (name) return name;

    const platform = info.platform;
    if (platform === 'android') return 'Android';
    if (platform === 'ios') return 'iPhone / iPad';
  } catch {
    // Capacitor Device no disponible (p. ej. SSR)
  }

  return labelFromUserAgent();
}

function cleanPart(value?: string): string {
  const v = (value ?? '').trim();
  if (!v || v.toLowerCase() === 'unknown') return '';
  return v;
}

/** Fallback para `ionic serve` / navegador sin plugin nativo. */
function labelFromUserAgent(): string {
  const ua = navigator.userAgent;

  const android = /Android[^;]*;\s*([^)]+)\)/i.exec(ua);
  if (android?.[1]) {
    const raw = android[1].replace(/Build\/.*/i, '').trim();
    if (raw) return raw;
  }

  const iphone = /iPhone|iPad|iPod/i.test(ua);
  if (iphone) return /iPad/i.test(ua) ? 'iPad' : 'iPhone';

  if (Capacitor.isNativePlatform()) return 'Dispositivo móvil';
  return 'Navegador web';
}
