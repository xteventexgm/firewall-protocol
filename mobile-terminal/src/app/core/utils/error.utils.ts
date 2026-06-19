/** Mensaje legible del evento `error` del backend (incluye código entre paréntesis). */
export function parseServerErrorMessage(msg: string): { message: string; code?: string } {
  const match = msg.match(/^(.+?)\s*\(([\w_]+)\)\s*$/);
  if (match) {
    return { message: match[1].trim(), code: match[2] };
  }
  return { message: msg };
}

export function formatServerErrorForToast(msg: string): string {
  const { message } = parseServerErrorMessage(msg);
  return message;
}
