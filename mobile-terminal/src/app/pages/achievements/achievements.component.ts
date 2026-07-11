import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, AuthUser } from '../../services/auth/auth.service';
import { ACHIEVEMENTS, AchievementDef } from '../../core/utils/achievements.utils';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-achievements',
  templateUrl: './achievements.component.html',
  styleUrls: ['./achievements.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class AchievementsComponent implements OnInit, OnDestroy {
  allAchievements: AchievementDef[] = ACHIEVEMENTS;
  unlockedIds: Set<string> = new Set();
  newIds: Set<string> = new Set();
  private subs = new Subscription();
  user: AuthUser | null = null;

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    // Get newly unlocked achievements from current session
    this.newIds = new Set(this.authService.getNewAchievements());

    this.subs.add(
      this.authService.profileUpdated$.subscribe((user) => {
        this.user = user;
        this.unlockedIds = new Set(user?.achievements || []);
      })
    );
    this.authService.refreshUser();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    // Clear the "new" badges when leaving this view
    this.authService.clearNewAchievements();
  }

  goBack() {
    this.router.navigate(['/login']);
  }
}
