export type PasswordIssue = 'password_too_short' | 'password_needs_letter' | 'password_needs_number';

export function validatePassword(password: string): PasswordIssue | null {
  if (!password || password.length < 8) return 'password_too_short';
  if (!/[a-zA-Z]/.test(password)) return 'password_needs_letter';
  if (!/[0-9]/.test(password)) return 'password_needs_number';
  return null;
}

export const PASSWORD_HINT =
  'Mínimo 8 caracteres, con al menos una letra y un número.';

export function passwordIssueMessage(code: PasswordIssue | string): string {
  const messages: Record<string, string> = {
    password_too_short: 'La contraseña debe tener al menos 8 caracteres.',
    password_needs_letter: 'La contraseña debe incluir al menos una letra.',
    password_needs_number: 'La contraseña debe incluir al menos un número.',
    password_mismatch: 'Las contraseñas no coinciden.',
    invalid_current_password: 'La contraseña actual no es correcta.',
  };
  return messages[code] ?? `Error: ${code}`;
}
