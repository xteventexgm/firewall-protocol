import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService, AuthUser, GameParticipation, UserProfileBundle } from '../../services/auth/auth.service';
import {
  PASSWORD_HINT,
  passwordIssueMessage,
  validatePassword,
} from '../../core/utils/password-policy.utils';

type PanelView = 'auth' | 'profile';
type ProfileSubView = 'overview' | 'edit' | 'history' | 'history-detail';

@Component({
  selector: 'app-account-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './account-panel.component.html',
  styleUrls: ['./account-panel.component.scss'],
})
export class AccountPanelComponent implements OnInit, OnDestroy {
  @Input() initialView: PanelView = 'auth';
  @Output() closed = new EventEmitter<void>();
  @Output() authChanged = new EventEmitter<void>();

  readonly passwordHint = PASSWORD_HINT;

  view: PanelView = 'auth';
  profileSubView: ProfileSubView = 'overview';
  authMode: 'login' | 'register' = 'login';
  authEmail = '';
  authUsername = '';
  authPassword = '';
  authPasswordConfirm = '';
  authBusy = false;
  authMessage = '';
  profileLoading = false;
  profileError = '';
  profileSuccess = '';
  profile: UserProfileBundle | null = null;
  saving = false;
  avatarUrlInput = '';
  avatarPreviewUrl: string | null = null;
  avatarDisplayUrl: string | null = null;
  avatarBroken = false;
  pendingAvatarFile: File | null = null;
  removeAvatarFlag = false;
  usernameInput = '';
  currentPassword = '';
  newPassword = '';
  newPasswordConfirm = '';
  selectedParticipation: GameParticipation | null = null;
  readonly historyLimit = 10;
  private subs = new Subscription();

  constructor(private authService: AuthService) {
    this.subs.add(
      this.authService.profileUpdated$.subscribe((user) => {
        this.applyUserToProfile(user);
      }),
    );
    this.subs.add(
      this.authService.avatarBlobChanged$.subscribe((blob) => {
        if (blob) {
          this.avatarDisplayUrl = blob;
          this.avatarBroken = false;
        } else if (!this.avatarPreviewUrl) {
          this.avatarDisplayUrl = null;
        }
      }),
    );
  }

  ngOnInit(): void {
    this.view = this.authService.isLoggedIn() ? 'profile' : this.initialView;
    if (this.view === 'profile') void this.loadProfile();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.revokePreview();
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get sheetTitle(): string {
    if (this.view === 'auth') return 'Cuenta';
    if (this.profileSubView === 'edit') return 'Editar perfil';
    if (this.profileSubView === 'history') return 'Historial de partidas';
    if (this.profileSubView === 'history-detail') return 'Detalle de partida';
    return 'Mi perfil';
  }

  get lastParticipation(): GameParticipation | null {
    return this.profile?.participations[0] ?? null;
  }

  get historyGames(): GameParticipation[] {
    return (this.profile?.participations ?? []).slice(0, this.historyLimit);
  }

  get totalParticipations(): number {
    return this.profile?.participations.length ?? 0;
  }

  get displayAvatarUrl(): string | null {
    if (this.avatarPreviewUrl) return this.avatarPreviewUrl;
    if (this.avatarBroken || this.removeAvatarFlag) return null;
    // Priorizar blob canónico del servicio (evita URLs revocadas tras recargas).
    const serviceBlob = this.authService.getAvatarBlobUrl();
    if (serviceBlob) return serviceBlob;
    return this.avatarDisplayUrl;
  }

  get initials(): string {
    const name = this.profile?.user.username ?? '';
    return name.slice(0, 2).toUpperCase() || '?';
  }

  dismiss(): void {
    this.revokePreview();
    this.closed.emit();
  }

  openHistory(): void {
    this.profileSubView = 'history';
    this.selectedParticipation = null;
  }

  openHistoryDetail(game: GameParticipation): void {
    this.selectedParticipation = game;
    this.profileSubView = 'history-detail';
  }

  backFromHistory(): void {
    this.profileSubView = 'overview';
    this.selectedParticipation = null;
  }

  backFromHistoryDetail(): void {
    this.profileSubView = 'history';
  }

  formatTeam(team?: string): string {
    const labels: Record<string, string> = {
      system: 'Sistema',
      black_hat: 'Black Hat',
      chaotic: 'Caótico',
    };
    return team ? (labels[team] ?? team) : '—';
  }

  openEditProfile(): void {
    this.profileError = '';
    this.profileSuccess = '';
    this.resetEditFormFromProfile();
    this.avatarBroken = false;
    this.profileSubView = 'edit';
    const blob = this.authService.getAvatarBlobUrl();
    if (blob) {
      this.avatarDisplayUrl = blob;
    } else if (this.profile?.user.avatarUrl) {
      void this.syncAvatarDisplayFromAuth();
    }
  }

  cancelEdit(): void {
    const avatarWasTouched = this.wasAvatarTouched();
    this.revokePreview();
    this.pendingAvatarFile = null;
    this.removeAvatarFlag = false;
    this.profileError = '';
    this.resetEditFormFromProfile();
    this.profileSubView = 'overview';
    this.avatarBroken = false;
    if (avatarWasTouched) {
      void this.refreshAvatarDisplay();
    }
  }

  async submitAuth(): Promise<void> {
    this.authBusy = true;
    this.authMessage = '';
    try {
      if (this.authMode === 'register') {
        if (!this.authEmail.trim() || !this.authEmail.includes('@')) {
          this.authMessage = 'El correo electrónico es obligatorio.';
          return;
        }
        const issue = validatePassword(this.authPassword);
        if (issue) {
          this.authMessage = passwordIssueMessage(issue);
          return;
        }
        if (this.authPassword !== this.authPasswordConfirm) {
          this.authMessage = passwordIssueMessage('password_mismatch');
          return;
        }
        if (!this.authUsername.trim() || this.authUsername.trim().length < 2) {
          this.authMessage = 'El nombre de usuario debe tener al menos 2 caracteres.';
          return;
        }
        await this.authService.register(
          this.authEmail.trim(),
          this.authUsername.trim(),
          this.authPassword,
        );
      } else {
        if (!this.authEmail.trim()) {
          this.authMessage = 'Ingresa tu correo electrónico.';
          return;
        }
        await this.authService.login(this.authEmail.trim(), this.authPassword);
      }
      this.authChanged.emit();
      this.view = 'profile';
      this.profileSubView = 'overview';
      this.profileError = '';
      this.authMessage = '';
      await this.loadProfile();
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'auth_failed';
      const messages: Record<string, string> = {
        invalid_credentials: 'Correo o contraseña incorrectos.',
        username_taken: 'Ese nombre de usuario ya existe.',
        email_taken: 'Ese correo ya está registrado.',
        email_required: 'El correo electrónico es obligatorio.',
        password_too_short: passwordIssueMessage('password_too_short'),
        password_needs_letter: passwordIssueMessage('password_needs_letter'),
        password_needs_number: passwordIssueMessage('password_needs_number'),
        username_too_short: 'El nombre de usuario no es válido.',
        username_empty: 'El nombre de usuario no puede estar vacío.',
        username_length: 'El nombre de usuario debe tener entre 2 y 24 caracteres.',
        username_invalid: 'Solo letras, números, guión, punto y guión bajo.',
        session_expired: 'Tu sesión expiró. Inicia sesión de nuevo.',
        network_error: this.authService.mapError('network_error'),
      };
      this.authMessage = messages[code] ?? this.authService.mapError(code);
      if (code === 'session_expired') this.view = 'auth';
    } finally {
      this.authBusy = false;
    }
  }

  async loadProfile(): Promise<void> {
    if (!this.isLoggedIn) return;
    await this.authService.ensureSessionFresh();
    this.profileLoading = true;
    this.profileError = '';
    try {
      this.profile = await this.authService.fetchProfile();
      this.resetEditFormFromProfile();
      this.avatarBroken = false;
      await this.syncAvatarDisplayFromAuth();
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'profile_fetch_failed';
      if (code === 'session_expired') {
        this.profile = null;
        this.avatarDisplayUrl = null;
        this.authService.revokeAvatarBlob();
        this.view = 'auth';
        this.authMessage = 'Tu sesión expiró o la cuenta ya no existe.';
        this.profileError = '';
        this.authChanged.emit();
      } else {
        this.profileError =
          code === 'network_error' ? this.authService.mapError(code) : code;
      }
    } finally {
      this.profileLoading = false;
    }
  }

  async saveProfileEdits(): Promise<void> {
    this.saving = true;
    this.profileError = '';
    this.profileSuccess = '';
    try {
      if (this.removeAvatarFlag) {
        await this.authService.deleteAvatar();
        this.authChanged.emit();
      } else if (this.pendingAvatarFile) {
        const user = await this.authService.uploadAvatar(this.pendingAvatarFile);
        this.pendingAvatarFile = null;
        this.applyUserToProfile(user);
        this.avatarBroken = false;
        await this.syncAvatarDisplayFromAuth();
        if (this.avatarDisplayUrl) this.revokePreview();
        this.authChanged.emit();
      } else if (this.avatarUrlInput.trim()) {
        const user = await this.authService.updateAvatarUrl(this.avatarUrlInput.trim());
        this.applyUserToProfile(user);
        await this.syncAvatarDisplayFromAuth();
        this.authChanged.emit();
      }

      const savedUsername = this.profile?.user.username ?? '';
      const usernameChanged = this.usernameInput.trim() !== savedUsername;

      if (usernameChanged) {
        if (!this.currentPassword) throw new Error('password_required_for_username');
        await this.authService.updateUsername(this.currentPassword, this.usernameInput);
      }

      const wantsPasswordChange = Boolean(this.newPassword || this.newPasswordConfirm);
      if (wantsPasswordChange) {
        const issue = validatePassword(this.newPassword);
        if (issue) throw new Error(issue);
        if (this.newPassword !== this.newPasswordConfirm) {
          throw new Error('password_mismatch');
        }
        if (!this.currentPassword) throw new Error('password_required');
        await this.authService.changePassword(this.currentPassword, this.newPassword);
        this.currentPassword = '';
        this.newPassword = '';
        this.newPasswordConfirm = '';
      }

      await this.loadProfile();
      this.profileSubView = 'overview';
      this.avatarBroken = false;
      this.profileSuccess = 'Cambios guardados.';
      this.authChanged.emit();
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'save_failed';
      const messages: Record<string, string> = {
        game_alias_empty: 'El nombre de usuario no puede estar vacío.',
        game_alias_length: 'El nombre de usuario debe tener entre 2 y 24 caracteres.',
        game_alias_invalid: 'Solo letras, números, guión, punto y guión bajo.',
        username_empty: 'El nombre de usuario no puede estar vacío.',
        username_length: 'El nombre de usuario debe tener entre 2 y 24 caracteres.',
        username_invalid: 'Solo letras, números, guión, punto y guión bajo.',
        username_taken: 'Ese nombre de usuario ya está en uso.',
        password_required_for_username: 'Ingresa tu contraseña actual para cambiar el nombre de usuario.',
        password_mismatch: passwordIssueMessage('password_mismatch'),
        password_required: 'Ingresa tu contraseña actual.',
        invalid_current_password: passwordIssueMessage('invalid_current_password'),
        password_too_short: passwordIssueMessage('password_too_short'),
        password_needs_letter: passwordIssueMessage('password_needs_letter'),
        password_needs_number: passwordIssueMessage('password_needs_number'),
        network_error: this.authService.mapError('network_error'),
      };
      this.profileError = messages[code] ?? this.authService.mapError(code);
    } finally {
      this.saving = false;
    }
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.revokePreview();
    this.pendingAvatarFile = file;
    this.removeAvatarFlag = false;
    this.avatarPreviewUrl = URL.createObjectURL(file);
    input.value = '';
  }

  markRemoveAvatar(): void {
    this.removeAvatarFlag = true;
    this.pendingAvatarFile = null;
    this.avatarUrlInput = '';
    this.revokePreview();
  }

  onAvatarImgError(): void {
    const serviceBlob = this.authService.getAvatarBlobUrl();
    if (serviceBlob && this.avatarDisplayUrl !== serviceBlob) {
      this.avatarDisplayUrl = serviceBlob;
      this.avatarBroken = false;
      return;
    }
    this.avatarBroken = true;
    if (this.profile?.user.avatarUrl && !this.avatarPreviewUrl) {
      void this.syncAvatarDisplayFromAuth();
    }
  }

  logout(): void {
    this.authService.logout();
    this.profile = null;
    this.revokePreview();
    this.avatarDisplayUrl = null;
    this.profileSubView = 'overview';
    this.profileError = '';
    this.profileSuccess = '';
    this.authChanged.emit();
    this.view = 'auth';
    this.authEmail = '';
    this.authUsername = '';
    this.authPassword = '';
  }

  teamWins(team: string): number {
    return this.profile?.user.stats.winsByTeam?.[team] ?? 0;
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private wasAvatarTouched(): boolean {
    const savedExternal = this.externalAvatarUrl(this.profile?.user.avatarUrl);
    return Boolean(
      this.pendingAvatarFile ||
      this.removeAvatarFlag ||
      this.avatarUrlInput.trim() !== savedExternal,
    );
  }

  private resetEditFormFromProfile(): void {
    if (!this.profile) return;
    this.avatarUrlInput = this.externalAvatarUrl(this.profile.user.avatarUrl);
    this.usernameInput = this.profile.user.username;
    this.currentPassword = '';
    this.newPassword = '';
    this.newPasswordConfirm = '';
    this.pendingAvatarFile = null;
    this.removeAvatarFlag = false;
    this.revokePreview();
  }

  private async refreshAvatarDisplay(): Promise<void> {
    const url = this.profile?.user.avatarUrl;
    if (!url || this.removeAvatarFlag) {
      this.avatarDisplayUrl = null;
      return;
    }
    this.avatarBroken = false;
    const prev = this.avatarDisplayUrl ?? this.authService.getAvatarBlobUrl();
    const blobUrl = await this.authService.loadAvatarBlobUrl(url);
    if (blobUrl) {
      this.avatarDisplayUrl = blobUrl;
      return;
    }
    if (prev) {
      this.avatarDisplayUrl = prev;
      return;
    }
    this.avatarBroken = true;
  }

  private applyUserToProfile(user: AuthUser): void {
    if (!this.profile) return;
    this.profile = { ...this.profile, user: { ...this.profile.user, ...user } };
  }

  private async syncAvatarDisplayFromAuth(): Promise<void> {
    const url = this.profile?.user.avatarUrl;
    if (!url || this.removeAvatarFlag) {
      this.avatarDisplayUrl = null;
      this.avatarBroken = false;
      return;
    }
    this.avatarBroken = false;
    const fresh = await this.authService.loadAvatarBlobUrl(url);
    if (fresh) {
      this.avatarDisplayUrl = fresh;
      return;
    }
    const fallback = this.authService.getAvatarBlobUrl();
    if (fallback) {
      this.avatarDisplayUrl = fallback;
      return;
    }
    this.avatarDisplayUrl = null;
    this.avatarBroken = true;
  }

  private externalAvatarUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('/api/auth/avatars/')) return '';
    return url.startsWith('http') ? url : '';
  }

  private revokePreview(): void {
    if (this.avatarPreviewUrl) {
      URL.revokeObjectURL(this.avatarPreviewUrl);
      this.avatarPreviewUrl = null;
    }
  }
}
