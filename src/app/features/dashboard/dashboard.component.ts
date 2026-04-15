import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';

import { DashboardSummary } from '../../core/models/dashboard-summary.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { I18nService } from '../../core/services/i18n.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface SummaryCard {
  key: keyof DashboardSummary;
  labelKey: string;
  icon: string;
  tone: 'users' | 'vehicles' | 'salespoints' | 'teams';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})


export class DashboardComponent implements OnInit {

  private readonly dashboardService = inject(DashboardService);
  readonly i18n = inject(I18nService);

  readonly cards: SummaryCard[] = [
    { key: 'usersCount', labelKey: 'dashboard.usersCount', icon: 'group', tone: 'users' },
    { key: 'vehiclesCount', labelKey: 'dashboard.vehiclesCount', icon: 'directions_car', tone: 'vehicles' },
    { key: 'salesPointsCount', labelKey: 'dashboard.salesPointsCount', icon: 'point_of_sale', tone: 'salespoints' },
    { key: 'teamsCount', labelKey: 'dashboard.teamsCount', icon: 'groups', tone: 'teams' },
  ];

  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);
  loadFailed = signal(false);

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.dashboardService
      .getSummary()
      .pipe(
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
        },
        error: () => {
          this.summary.set(null);
          this.loadFailed.set(true);
        },
      });
  }

  valueFor(card: SummaryCard): number {
    return this.summary()?.[card.key] ?? 0;
  }


}
