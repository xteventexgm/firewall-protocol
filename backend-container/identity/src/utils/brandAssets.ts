import * as fs from 'fs';
import * as path from 'path';

export function resolveBrandIconPath(): string | null {
  const candidates = [
    path.join(__dirname, '../../assets/icon.png'),
    path.join(process.cwd(), 'assets/icon.png'),
    path.join(process.cwd(), '../mobile-terminal/assets/icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
