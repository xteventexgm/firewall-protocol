import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ROLE_CATALOG, Role, RoleName, Team } from '../../core/models/roles.data';
import { parseRoleCopy, ParsedRoleInfo } from '../../core/utils/role-copy.utils';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-encyclopedia-modal',
  templateUrl: './encyclopedia-modal.component.html',
  styleUrls: ['./encyclopedia-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, LucideAngularModule]
})
export class EncyclopediaModalComponent implements OnInit {
  searchTerm = '';
  selectedTeam: 'all' | 'system' | 'black_hat' | 'chaotic' = 'all';
  
  allRoles: Role[] = [];
  filteredRoles: Role[] = [];
  expandedRole: RoleName | null = null;
  favoriteRoles: string[] = [];

  constructor(
    private modalCtrl: ModalController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.allRoles = Object.values(ROLE_CATALOG).sort((a, b) => 
      a.displayName.localeCompare(b.displayName)
    );
    this.filteredRoles = [...this.allRoles];

    const user = this.authService.getUser();
    if (user?.stats?.favoriteRoles) {
      this.favoriteRoles = user.stats.favoriteRoles;
    }
  }

  close() {
    this.modalCtrl.dismiss();
  }

  filterRoles() {
    this.filteredRoles = this.allRoles.filter(role => {
      const matchesSearch = role.displayName.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
                            (role.description && role.description.toLowerCase().includes(this.searchTerm.toLowerCase()));
      const matchesTeam = this.selectedTeam === 'all' || role.team === this.selectedTeam;
      return matchesSearch && matchesTeam;
    });
  }

  onSearchChange(event: any) {
    this.searchTerm = event.detail.value || '';
    this.filterRoles();
  }

  setTeamFilter(team: 'all' | 'system' | 'black_hat' | 'chaotic') {
    this.selectedTeam = team;
    this.filterRoles();
  }

  toggleExpand(role: Role) {
    if (this.expandedRole === role.id) {
      this.expandedRole = null;
    } else {
      this.expandedRole = role.id;
    }
  }

  parseText(text: string | undefined): ParsedRoleInfo {
    return parseRoleCopy(text);
  }

  hasPlayed(roleId: string): boolean {
    return this.favoriteRoles.includes(roleId);
  }
}
