export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) return 'password_too_short';
  if (!/[a-zA-Z]/.test(password)) return 'password_needs_letter';
  if (!/[0-9]/.test(password)) return 'password_needs_number';
  return null;
}

export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (!u) return 'username_empty';
  if (u.length < 2 || u.length > 24) return 'username_length';
  if (!/^[a-zA-Z0-9_\-.]+$/.test(u)) return 'username_invalid';
  return null;
}
