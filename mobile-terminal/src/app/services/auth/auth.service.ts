import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { apiTunnelHeaders, networkErrorMessage, resolveApiBase } from '../../core/utils/api-base.utils';
import { getDeviceLabel } from '../../core/utils/device-info.utils';
import { validatePassword } from '../../core/utils/password-policy.utils';

export interface UserStats {
  gamesPlayed: number;
  mvpCount: number;
  winsByTeam: Record<string, number>;
  favoriteRoles: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  authProvider?: string;
  avatarUrl?: string;
  preferredLocale?: string;
  emailVerified?: boolean;
  stats: UserStats;
  achievements?: string[];
  linkedGuestIds: string[];
  createdAt: string;
  lastLoginAt?: string;
  isActive?: boolean;
}

export interface GameParticipation {
  roomId: string;
  playerName: string;
  role?: string;
  team?: string;
  won: boolean;
  isMvp: boolean;
  eliminatedOnDay?: number;
  finishedAt: string;
}

export interface UserProfileBundle {
  user: AuthUser;
  participations: GameParticipation[];
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEYS = {
  accessToken: 'fp_accessToken',
  refreshToken: 'fp_refreshToken',
  user: 'fp_user',
  avatarRev: 'fp_avatarRev',
} as const;

const SESSION_EXPIRED = 'session_expired';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private avatarBlobUrl: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private readonly profileUpdated = new Subject<AuthUser>();
  private readonly avatarBlobChanged = new Subject<string | null>();
  /** Emite cuando el usuario en localStorage cambia (avatar, username, etc.). */
  readonly profileUpdated$ = this.profileUpdated.asObservable();
  /** Emite cuando el blob del avatar en memoria cambia (recarga tras fetch). */
  readonly avatarBlobChanged$ = this.avatarBlobChanged.asObservable();

  private apiBase(): string {
    return resolveApiBase();
  }

  private async apiFetch(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch {
      throw new Error('network_error');
    }
  }

  /** Reintenta con refresh token si el access JWT expiró (sesión hasta cerrar sesión). */
  private async authorizedFetch(url: string, init?: RequestInit): Promise<Response> {
    let res = await this.apiFetch(url, init);
    if (res.status !== 401 || !localStorage.getItem(STORAGE_KEYS.refreshToken)) {
      return res;
    }
    const refreshed = await this.refreshAccessToken();
    if (!refreshed) return res;
    const retryInit = { ...init, headers: this.mergeAuthHeaders(init?.headers) };
    return this.apiFetch(url, retryInit);
  }

  private mergeAuthHeaders(existing?: HeadersInit): Record<string, string> {
    const base = this.headers(false);
    if (!existing) return base;
    if (existing instanceof Headers) {
      existing.forEach((v, k) => {
        base[k] = v;
      });
      return base;
    }
    if (Array.isArray(existing)) {
      for (const [k, v] of existing) base[k] = v;
      return base;
    }
    return { ...base, ...existing };
  }

  async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefreshAccessToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshAccessToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    if (!refreshToken) return false;
    try {
      const res = await this.apiFetch(`${this.apiBase()}/api/auth/refresh`, {
        method: 'POST',
        headers: { ...apiTunnelHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await this.readJson(res);
      if (!res.ok) return false;
      localStorage.setItem(STORAGE_KEYS.accessToken, String(data['accessToken'] ?? ''));
      if (data['refreshToken']) {
        localStorage.setItem(STORAGE_KEYS.refreshToken, String(data['refreshToken']));
      }
      if (data['user']) this.persistUser(data['user'] as AuthUser);
      return Boolean(data['accessToken']);
    } catch {
      return false;
    }
  }

  /** Decodifica `exp` del JWT de acceso (sin verificar firma — solo UX local). */
  private getAccessTokenExpiresAt(token: string): number | null {
    try {
      const segment = token.split('.')[1];
      if (!segment) return null;
      const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(padded)) as { exp?: number };
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private isAccessTokenExpiringSoon(token: string, bufferMs = 10 * 60 * 1000): boolean {
    const exp = this.getAccessTokenExpiresAt(token);
    if (!exp) return true;
    return exp <= Date.now() + bufferMs;
  }

  /**
   * Renueva tokens al abrir o reanudar la app, antes de que caduque el access.
   * Cada refresh exitoso rota el refresh en Mongo y extiende su validez (p. ej. +90 días).
   */
  async ensureSessionFresh(): Promise<boolean> {
    if (!localStorage.getItem(STORAGE_KEYS.user)) return false;

    const refresh = localStorage.getItem(STORAGE_KEYS.refreshToken);
    if (!refresh) return Boolean(this.getAccessToken());

    const access = this.getAccessToken();
    const shouldRefresh = !access || this.isAccessTokenExpiringSoon(access);
    if (!shouldRefresh) return true;

    const ok = await this.refreshAccessToken();
    if (ok) return true;
    return Boolean(this.getAccessToken());
  }

  private async readJson(res: Response): Promise<Record<string, unknown>> {
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = { ...apiTunnelHeaders() };
    if (json) h['Content-Type'] = 'application/json';
    const token = this.getAccessToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  isLoggedIn(): boolean {
    const hasUser = Boolean(localStorage.getItem(STORAGE_KEYS.user));
    const hasSession = Boolean(this.getAccessToken() || localStorage.getItem(STORAGE_KEYS.refreshToken));
    return hasUser && hasSession;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.accessToken);
  }

  getUser(): AuthUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  /** Invitados siempre pueden jugar; cuentas registradas requieren correo verificado. */
  canPlay(): boolean {
    if (!this.isLoggedIn()) return true;
    return this.getUser()?.emailVerified !== false;
  }

  /** Sincroniza datos del usuario desde el servidor (p. ej. tras verificar correo en web). */
  async refreshUser(): Promise<AuthUser | null> {
    if (!this.isLoggedIn()) return null;
    await this.ensureSessionFresh();
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/me`, { headers: this.headers(false) });
    const data = await this.readJson(res);
    if (!res.ok) return this.getUser();
    const user = data['user'] as AuthUser | undefined;
    if (user) this.persistUser(user);
    return user ?? null;
  }

  /** Nombre visible en partidas (= username de la cuenta). */
  getDisplayName(): string | null {
    return this.getUser()?.username ?? null;
  }

  async checkAuthAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase()}/api/auth/status`, { headers: this.headers(false) });
      if (!res.ok) return false;
      const data = (await res.json()) as { enabled?: boolean };
      return data.enabled === true;
    } catch {
      return false;
    }
  }

  /** Construye URL absoluta para mostrar avatar (subido o externo). */
  resolveAvatarUrl(avatarUrl?: string, cacheBust = false): string | null {
    if (!avatarUrl) return null;
    const base = this.apiBase();
    let url = avatarUrl;
    if (url.startsWith('/')) url = `${base}${url}`;
    else if (!/^https?:\/\//i.test(url)) url = `${base}/${url}`;
    if (url.includes('/api/auth/avatars/')) {
      // La ruta no cambia al re-subir; forzar ?v= distinto evita caché HTTP del navegador.
      const v = cacheBust
        ? String(Date.now())
        : (localStorage.getItem(STORAGE_KEYS.avatarRev) ?? String(Date.now()));
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}v=${v}`;
    } else if (cacheBust) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}v=${Date.now()}`;
    }
    return url;
  }

  /** Invalida caché HTTP del avatar (misma ruta `/api/auth/avatars/:id` en cada subida). */
  bumpAvatarCache(): void {
    localStorage.setItem(STORAGE_KEYS.avatarRev, String(Date.now()));
  }

  /** Asigna blob en memoria (p. ej. preview local tras elegir archivo). */
  setAvatarBlob(blobUrl: string): void {
    if (this.avatarBlobUrl) URL.revokeObjectURL(this.avatarBlobUrl);
    this.avatarBlobUrl = blobUrl;
    this.avatarBlobChanged.next(blobUrl);
  }

  /** Carga avatar subido vía fetch (más fiable en móvil/LAN que `<img src>` directo). */
  async loadAvatarBlobUrl(avatarUrl?: string): Promise<string | null> {
    const resolved = this.resolveAvatarUrl(avatarUrl, true);
    if (!resolved) return this.avatarBlobUrl;
    if (!resolved.includes('/api/auth/avatars/')) return resolved;

    const attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await this.authorizedFetch(resolved, {
          headers: this.headers(false),
          cache: 'no-store',
        });
        if (res.ok) {
          const blob = await res.blob();
          const next = URL.createObjectURL(blob);
          if (this.avatarBlobUrl) URL.revokeObjectURL(this.avatarBlobUrl);
          this.avatarBlobUrl = next;
          this.avatarBlobChanged.next(next);
          return this.avatarBlobUrl;
        }
        if (res.status !== 404 || i === attempts - 1) break;
      } catch {
        if (i === attempts - 1) break;
      }
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
    return this.avatarBlobUrl;
  }

  revokeAvatarBlob(): void {
    if (this.avatarBlobUrl) {
      URL.revokeObjectURL(this.avatarBlobUrl);
      this.avatarBlobUrl = null;
      this.avatarBlobChanged.next(null);
    }
  }

  /** Blob en memoria tras `loadAvatarBlobUrl` (para UI sin segundo fetch). */
  getAvatarBlobUrl(): string | null {
    return this.avatarBlobUrl;
  }

  async uploadAvatar(file: File): Promise<AuthUser> {
    const form = new FormData();
    form.append('avatar', file, file.name || 'avatar.jpg');
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/avatar`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'avatar_upload_failed'));
    const user = data['user'] as AuthUser;
    if (!user?.id) throw new Error('avatar_upload_failed');

    this.bumpAvatarCache();
    this.setAvatarBlob(URL.createObjectURL(file));
    this.persistUser(user);

    if (user.avatarUrl) {
      await this.loadAvatarBlobUrl(user.avatarUrl);
    }
    return user;
  }

  async deleteAvatar(): Promise<AuthUser | null> {
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/avatar`, {
      method: 'DELETE',
      headers: this.headers(false),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'avatar_delete_failed'));
    this.revokeAvatarBlob();
    const user = data['user'] as AuthUser | undefined;
    if (user) {
      this.bumpAvatarCache();
      this.persistUser(user);
    } else localStorage.removeItem(STORAGE_KEYS.user);
    return user ?? null;
  }

  async fetchProfile(): Promise<UserProfileBundle> {
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/profile`, { headers: this.headers(false) });
    const data = await this.readJson(res);
    if (!res.ok) {
      this.maybeLogoutOnAuthFailure(res.status, String(data['code'] ?? ''));
      throw new Error(String(data['code'] || data['error'] || 'profile_fetch_failed'));
    }
    this.persistUser(data['user'] as AuthUser);
    return data as unknown as UserProfileBundle;
  }

  async validateSession(): Promise<boolean> {
    if (!localStorage.getItem(STORAGE_KEYS.refreshToken) && !this.getAccessToken()) return false;
    if (!localStorage.getItem(STORAGE_KEYS.user)) return false;
    await this.ensureSessionFresh();
    try {
      await this.fetchProfile();
      return true;
    } catch {
      if (await this.refreshAccessToken()) {
        try {
          await this.fetchProfile();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async updateAvatarUrl(avatarUrl: string): Promise<AuthUser> {
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/profile`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ avatarUrl }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'invalid_avatar_url'));
    const user = data['user'] as AuthUser;
    this.bumpAvatarCache();
    this.revokeAvatarBlob();
    this.persistUser(user);
    if (user?.avatarUrl) await this.loadAvatarBlobUrl(user.avatarUrl);
    return user;
  }

  async updateUsername(currentPassword: string, username: string): Promise<AuthUser> {
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/change-username`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ currentPassword, username: username.trim() }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'username_change_failed'));
    const user = data['user'] as AuthUser;
    this.persistUser(user);
    return user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const issue = validatePassword(newPassword);
    if (issue) throw new Error(issue);
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/change-password`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'password_change_failed'));
  }

  async register(email: string, username: string, password: string): Promise<AuthSession> {
    const issue = validatePassword(password);
    if (issue) throw new Error(issue);
    const deviceId = await getDeviceLabel();
    const res = await this.apiFetch(`${this.apiBase()}/api/auth/register`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ email: email.trim(), username: username.trim(), password, deviceId }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'register_failed'));
    this.persistSession(data as unknown as AuthSession);
    return data as unknown as AuthSession;
  }

  async login(login: string, password: string): Promise<AuthSession> {
    const deviceId = await getDeviceLabel();
    const res = await this.apiFetch(`${this.apiBase()}/api/auth/login`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ login: login.trim(), password, deviceId }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'invalid_credentials'));
    this.persistSession(data as unknown as AuthSession);
    return data as unknown as AuthSession;
  }

  async forgotPassword(email: string): Promise<void> {
    const res = await this.apiFetch(`${this.apiBase()}/api/auth/forgot-password`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'forgot_password_failed'));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const issue = validatePassword(newPassword);
    if (issue) throw new Error(issue);
    const res = await this.apiFetch(`${this.apiBase()}/api/auth/reset-password`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ token: token.trim(), newPassword }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'invalid_reset_token'));
  }

  async verifyEmail(token: string): Promise<AuthUser> {
    const res = await this.apiFetch(`${this.apiBase()}/api/auth/verify-email`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ token: token.trim() }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'invalid_verify_token'));
    const user = data['user'] as AuthUser;
    if (user) this.persistUser(user);
    return user;
  }

  async resendVerificationEmail(): Promise<void> {
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/resend-verification`, {
      method: 'POST',
      headers: this.headers(false),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'email_send_failed'));
  }

  mapError(code: string): string {
    if (code === 'network_error') return networkErrorMessage();
    return code;
  }

  async linkGuest(guestPlayerId: string): Promise<void> {
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/link-guest`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ guestPlayerId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.code || 'link_failed');
    }
  }

  async requestDeleteAccount(): Promise<void> {
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/request-delete-account`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'email_send_failed'));
  }

  async confirmDeleteAccount(token: string, password: string): Promise<void> {
    const res = await this.authorizedFetch(`${this.apiBase()}/api/auth/confirm-delete-account`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ token: token.trim(), password }),
    });
    const data = await this.readJson(res);
    if (!res.ok) throw new Error(String(data['code'] || data['error'] || 'delete_account_failed'));
    this.logout();
  }

  logout(): void {
    const refresh = localStorage.getItem(STORAGE_KEYS.refreshToken);
    if (refresh) {
      void fetch(`${this.apiBase()}/api/auth/logout`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ refreshToken: refresh }),
      });
    }
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.avatarRev);
    this.revokeAvatarBlob();
  }

  private maybeLogoutOnAuthFailure(status: number, code?: string): void {
    const expired =
      status === 401 ||
      status === 404 ||
      code === 'unauthorized' ||
      code === 'user_not_found' ||
      code === 'invalid_refresh_token';
    if (expired) {
      this.logout();
      throw new Error(SESSION_EXPIRED);
    }
  }

  private persistSession(data: AuthSession): void {
    localStorage.setItem(STORAGE_KEYS.accessToken, data.accessToken);
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
    if (data.user.avatarUrl) this.bumpAvatarCache();
    this.persistUser(data.user);
  }

  private persistUser(user: AuthUser): void {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    this.profileUpdated.next(user);
  }
  async unlockAchievement(achievementId: string): Promise<void> {
    const res = await fetch(`${this.apiBase()}/api/auth/achievements`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ achievementId }),
    });

    if (!res.ok) {
      const err = await res.json();
      this.maybeLogoutOnAuthFailure(res.status, err?.code);
      throw new Error(err?.error || 'Failed to unlock achievement');
    }

    // Refresh user profile so achievements are up to date in frontend
    await this.refreshUser();
  }
}
