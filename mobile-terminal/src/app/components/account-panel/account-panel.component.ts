import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService, UserProfileBundle } from '../../services/auth/auth.service';
import {
  PASSWORD_HINT,
  passwordIssueMessage,
  validatePassword,
} from '../../core/utils/password-policy.utils';

type PanelView = 'auth' | 'profile';
type ProfileSubView = 'overview' | 'edit';

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

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.view = this.authService.isLoggedIn() ? 'profile' : this.initialView;
    if (this.view === 'profile') void this.loadProfile();
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get sheetTitle(): string {
    if (this.view === 'auth') return 'Cuenta';
    return this.profileSubView === 'edit' ? 'Editar perfil' : 'Mi perfil';
  }

  get displayAvatarUrl(): string | null {
    if (this.avatarPreviewUrl) return this.avatarPreviewUrl;
    if (this.avatarBroken || this.removeAvatarFlag) return null;
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

  openEditProfile(): void {
    this.profileError = '';
    this.profileSuccess = '';
    this.resetEditFormFromProfile();
    this.profileSubView = 'edit';
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
    this.profileLoading = true;
    this.profileError = '';
    try {
      this.profile = await this.authService.fetchProfile();
      this.resetEditFormFromProfile();
      this.avatarBroken = false;
      await this.refreshAvatarDisplay();
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
      } else if (this.pendingAvatarFile) {
        await this.authService.uploadAvatar(this.pendingAvatarFile);
        this.pendingAvatarFile = null;
      } else if (this.avatarUrlInput.trim()) {
        await this.authService.updateAvatarUrl(this.avatarUrlInput.trim());
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
    this.avatarBroken = true;
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
    this.avatarDisplayUrl = await this.authService.loadAvatarBlobUrl(url);
    if (!this.avatarDisplayUrl) this.avatarBroken = true;
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
