import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import {
  Chart,
  ChartConfiguration,
  ChartData,
  ChartDataset,
  ChartOptions,
  TooltipItem,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { finalize, forkJoin } from 'rxjs';

import {
  DashboardSalesByPoint,
  DashboardSalesByZone,
  DashboardSalesMetric,
  DashboardTopSalesPoint,
  DashboardTopSalesZone,
} from '../../core/models/dashboard-sales.model';
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

interface SalesKpiCard {
  labelKey: string;
  value: string;
  subtitle: string;
  icon: string;
}

type SalesChartDataset = ChartDataset<'bar', number[]>;
type SalesChartData = ChartData<'bar', number[], string>;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSortModule,
    MatTableModule,
    BaseChartDirective,
    TranslatePipe,
  ],
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
  readonly salesTableColumns = ['salesPointName', 'zone', 'totalQuantity', 'totalAmount'];
  readonly chartLegend = false;

  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);
  loadFailed = signal(false);

  salesLoading = signal(true);
  salesLoadFailed = signal(false);
  salesByPoint = signal<DashboardSalesByPoint[]>([]);
  salesByZone = signal<DashboardSalesByZone[]>([]);
  topZone = signal<DashboardTopSalesZone | null>(null);
  topPoint = signal<DashboardTopSalesPoint | null>(null);
  selectedMetric = signal<DashboardSalesMetric>('totalAmount');
  topPointLimit = signal<5 | 10>(5);

  dataSource = new MatTableDataSource<DashboardSalesByPoint>([]);

  readonly totalRevenue = computed(() =>
    this.salesByPoint().reduce((sum, point) => sum + point.totalAmount, 0),
  );
  readonly totalUnitsSold = computed(() =>
    this.salesByPoint().reduce((sum, point) => sum + point.totalQuantity, 0),
  );
  readonly hasSalesData = computed(
    () => this.salesByPoint().length > 0 || this.salesByZone().length > 0,
  );
  readonly topPointChartRows = computed(() =>
    [...this.salesByPoint()]
      .sort((left, right) => this.metricValue(right) - this.metricValue(left))
      .slice(0, this.topPointLimit()),
  );
  readonly salesKpis = computed<SalesKpiCard[]>(() => [
    {
      labelKey: 'dashboard.totalRevenue',
      value: this.formatCurrency(this.totalRevenue()),
      subtitle: this.i18n.t('dashboard.fromAllPoints'),
      icon: 'payments',
    },
    {
      labelKey: 'dashboard.totalUnitsSold',
      value: this.formatNumber(this.totalUnitsSold()),
      subtitle: this.i18n.t('dashboard.fromAllPoints'),
      icon: 'inventory_2',
    },
    {
      labelKey: 'dashboard.topSalesZone',
      value: this.topZone()?.zone || this.i18n.t('dashboard.noSalesData'),
      subtitle: this.topZone()
        ? this.formatMetricValue(this.metricValue(this.topZone()!))
        : this.i18n.t('dashboard.awaitingSalesData'),
      icon: 'map',
    },
    {
      labelKey: 'dashboard.topPointOfSale',
      value: this.topPoint()?.salesPointName || this.i18n.t('dashboard.noSalesData'),
      subtitle: this.topPoint()?.zone || this.i18n.t('dashboard.awaitingSalesData'),
      icon: 'storefront',
    },
  ]);
  readonly zoneChartData = computed<SalesChartData>(() =>
    this.createChartData(
      [...this.salesByZone()].sort(
        (left, right) => this.metricValue(right) - this.metricValue(left),
      ),
      (item) => item.zone,
      'rgba(15, 118, 110, 0.78)',
      'rgba(15, 118, 110, 1)',
    ),
  );
  readonly topPointChartData = computed<SalesChartData>(() =>
    this.createChartData(
      this.topPointChartRows(),
      (item) => item.salesPointName,
      'rgba(37, 99, 235, 0.76)',
      'rgba(37, 99, 235, 1)',
    ),
  );
  readonly zoneChartOptions = computed(() => this.buildChartOptions('zone'));
  readonly topPointChartOptions = computed(() => this.buildChartOptions('point'));
  readonly zoneChartHeight = computed(() =>
    this.resolveChartHeight(this.salesByZone().length, 320, 440),
  );
  readonly topPointChartHeight = computed(() =>
    this.resolveChartHeight(this.topPointChartRows().length, 320, 500),
  );

  @ViewChild('zoneChart', { read: BaseChartDirective })
  zoneChart?: BaseChartDirective<'bar', number[], string>;

  @ViewChild('topPointChart', { read: BaseChartDirective })
  topPointChart?: BaseChartDirective<'bar', number[], string>;

  @ViewChild(MatSort)
  set tableSort(sort: MatSort | undefined) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  constructor() {
    effect(() => {
      this.dataSource.data = this.salesByPoint();
    });

    effect(() => {
      this.zoneChartData();
      this.topPointChartData();
      queueMicrotask(() => this.refreshCharts());
    });

    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'salesPointName':
          return item.salesPointName.toLowerCase();
        case 'zone':
          return item.zone.toLowerCase();
        case 'totalQuantity':
          return item.totalQuantity;
        case 'totalAmount':
          return item.totalAmount;
        default:
          return '';
      }
    };
  }

  ngOnInit(): void {
    this.refreshDashboard();
  }

  refreshDashboard(): void {
    this.loadSummary();
    this.loadSalesStatistics();
  }

  loadSummary(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.dashboardService
      .getSummary()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: () => {
          this.summary.set(null);
          this.loadFailed.set(true);
        },
      });
  }

  loadSalesStatistics(): void {
    this.salesLoading.set(true);
    this.salesLoadFailed.set(false);

    forkJoin({
      salesByPoint: this.dashboardService.getSalesByPoint(),
      salesByZone: this.dashboardService.getSalesByZone(),
      topZone: this.dashboardService.getTopSalesZone(),
      topPoint: this.dashboardService.getTopSalesPoint(),
    })
      .pipe(finalize(() => this.salesLoading.set(false)))
      .subscribe({
        next: ({ salesByPoint, salesByZone, topZone, topPoint }) => {
          this.salesByPoint.set(this.normalizePointRows(salesByPoint));
          this.salesByZone.set(this.normalizeZoneRows(salesByZone));
          this.topZone.set(this.normalizeZoneRow(topZone));
          this.topPoint.set(this.normalizePointRow(topPoint));
          queueMicrotask(() => this.refreshCharts());
        },
        error: () => {
          this.salesByPoint.set([]);
          this.salesByZone.set([]);
          this.topZone.set(null);
          this.topPoint.set(null);
          this.salesLoadFailed.set(true);
        },
      });
  }

  valueFor(card: SummaryCard): number {
    return this.summary()?.[card.key] ?? 0;
  }

  setMetric(metric: DashboardSalesMetric): void {
    this.selectedMetric.set(metric);
    queueMicrotask(() => this.refreshCharts());
  }

  setTopPointLimit(limit: 5 | 10): void {
    this.topPointLimit.set(limit);
    queueMicrotask(() => this.refreshCharts());
  }

  metricLabel(): string {
    return this.selectedMetric() === 'totalAmount'
      ? this.i18n.t('dashboard.revenueMetric')
      : this.i18n.t('dashboard.quantityMetric');
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat(this.i18n.locale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)} MRU`;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), {
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatMetricValue(value: number): string {
    return this.selectedMetric() === 'totalAmount'
      ? this.formatCurrency(value)
      : this.formatNumber(value);
  }

  private buildChartOptions(kind: 'zone' | 'point'): ChartOptions<'bar'> {
    const tickColor = '#64748b';
    const labelColor = '#0f172a';
    const gridColor = 'rgba(148, 163, 184, 0.18)';
    const labelLimit = kind === 'zone' ? 22 : 24;

    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      animation: false,
      layout: {
        padding: { top: 6, right: 8, bottom: 0, left: 0 },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: gridColor,
          },
          border: { display: false },
          ticks: {
            color: tickColor,
            font: { size: 11, weight: 600 },
            callback: (value) => this.formatMetricValue(Number(value)),
            maxTicksLimit: 6,
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: labelColor,
            font: { size: 12, weight: 600 },
            callback: (_, index) => {
              const label = this.resolveLabel(kind, index);
              return label.length > labelLimit ? `${label.slice(0, labelLimit - 3)}...` : label;
            },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.96)',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(148, 163, 184, 0.28)',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => this.tooltipMetricLabel(item),
          },
        },
      },
      datasets: {
        bar: {
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 18,
          maxBarThickness: 22,
        },
      },
    };
  }

  private createChartData<T extends DashboardSalesByPoint | DashboardSalesByZone>(
    items: T[],
    labelSelector: (item: T) => string,
    backgroundColor: string,
    borderColor: string,
  ): SalesChartData {
    return {
      labels: items.map(labelSelector),
      datasets: [
        {
          data: items.map((item) => Number(this.metricValue(item) ?? 0)),
          backgroundColor,
          borderColor,
          borderWidth: 1,
          hoverBackgroundColor: borderColor,
          categoryPercentage: 0.72,
          barPercentage: 0.88,
        } satisfies SalesChartDataset,
      ],
    };
  }

  private tooltipMetricLabel(item: TooltipItem<'bar'>): string {
    const value = item.parsed.x ?? 0;

    return this.selectedMetric() === 'totalAmount'
      ? this.formatCurrency(value)
      : this.formatNumber(value);
  }

  private resolveLabel(kind: 'zone' | 'point', index: number): string {
    const labels =
      kind === 'zone'
        ? this.zoneChartData().labels ?? []
        : this.topPointChartData().labels ?? [];

    return String(labels[index] ?? '');
  }

  private resolveChartHeight(length: number, minHeight: number, maxHeight: number): number {
    return Math.min(Math.max(length * 38 + 92, minHeight), maxHeight);
  }

  private refreshCharts(): void {
    this.zoneChart?.update();
    this.topPointChart?.update();
  }

  private normalizePointRows(rows: unknown): DashboardSalesByPoint[] {
    return Array.isArray(rows)
      ? rows
          .map((row) => this.normalizePointRow(row))
          .filter((row): row is DashboardSalesByPoint => row !== null)
      : [];
  }

  private normalizeZoneRows(rows: unknown): DashboardSalesByZone[] {
    return Array.isArray(rows)
      ? rows
          .map((row) => this.normalizeZoneRow(row))
          .filter((row): row is DashboardSalesByZone => row !== null)
      : [];
  }

  private normalizePointRow(row: unknown): DashboardSalesByPoint | null {
    if (!row || typeof row !== 'object') {
      return null;
    }

    const candidate = row as Record<string, unknown>;
    const salesPointName = String(candidate['salesPointName'] ?? '').trim();
    const zone = String(candidate['zone'] ?? '').trim();

    if (!salesPointName) {
      return null;
    }

    return {
      salesPointId: Number(candidate['salesPointId'] ?? 0),
      salesPointName,
      zone,
      totalQuantity: Number(candidate['totalQuantity'] ?? 0),
      totalAmount: Number(candidate['totalAmount'] ?? 0),
    };
  }

  private normalizeZoneRow(row: unknown): DashboardSalesByZone | null {
    if (!row || typeof row !== 'object') {
      return null;
    }

    const candidate = row as Record<string, unknown>;
    const zone = String(candidate['zone'] ?? '').trim();

    if (!zone) {
      return null;
    }

    return {
      zone,
      totalQuantity: Number(candidate['totalQuantity'] ?? 0),
      totalAmount: Number(candidate['totalAmount'] ?? 0),
    };
  }

  private metricValue(
    item:
      | DashboardSalesByPoint
      | DashboardSalesByZone
      | DashboardTopSalesPoint
      | DashboardTopSalesZone,
  ): number {
    return this.selectedMetric() === 'totalAmount' ? item.totalAmount : item.totalQuantity;
  }
}
