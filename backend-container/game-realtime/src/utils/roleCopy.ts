/**
 * Limpia markdown ligero en textos de rol para el móvil.
 */
export function formatRoleCopy(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
