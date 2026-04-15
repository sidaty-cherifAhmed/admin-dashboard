import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import * as L from 'leaflet';
import {
  catchError,
  distinctUntilChanged,
  finalize,
  forkJoin,
  Subscription,
  map,
  of,
  startWith,
  switchMap,
  timer,
  timeout,
} from 'rxjs';

import { LatestGpsLog } from '../../core/models/latest-gps-log.model';
import { Tour, TourStatus } from '../../core/models/tour.model';
import { Vehicle } from '../../core/models/vehicle.model';
import { LiveTrackingService } from '../../core/services/live-tracking.service';
import { VehiclesService } from '../../core/services/vehicles.service';
import { I18nService } from '../../core/services/i18n.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type LocationResult =
  | { kind: 'data'; log: LatestGpsLog }
  | { kind: 'empty' }
  | { kind: 'error' };

@Component({
  selector: 'app-live-tracking',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslatePipe,
  ],
  templateUrl: './live-tracking.component.html',
  styleUrl: './live-tracking.component.scss',
})
export class LiveTrackingComponent implements OnInit, OnDestroy {

  private readonly liveTrackingService = inject(LiveTrackingService);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);

  @ViewChild('mapContainer')
  set mapHost(element: ElementRef<HTMLDivElement> | undefined) {
    this.mapContainer = element;

    if (element) {
      queueMicrotask(() => this.initializeMap());
    }
  }

  readonly filterForm = this.fb.group({
    tourId: this.fb.control<number | null>(null),
  });

  startedTours = signal<Tour[]>([]);
  vehicles = signal<Vehicle[]>([]);
  selectedTour = signal<Tour | null>(null);
  latestLog = signal<LatestGpsLog | null>(null);

  toursLoading = signal(true);
  showToursLoading = signal(false);
  toursError = signal(false);
  locationLoading = signal(false);
  locationRefreshing = signal(false);
  locationError = signal(false);
  locationUnavailable = signal(false);

  private map?: L.Map;
  private mapContainer?: ElementRef<HTMLDivElement>;
  private marker?: L.Marker;
  private lastLogTime: string | null = null;
  private lastCenteredTourId: number | null = null;
  private toursLoadingIndicatorTimer?: Subscription;

  ngOnInit(): void {
    this.loadTrackingPageData();
    this.bindTrackingStream();
  }

  ngOnDestroy(): void {
    this.toursLoadingIndicatorTimer?.unsubscribe();
    this.map?.remove();
    this.map = undefined;
    this.marker = undefined;
  }

  reloadTours(): void {
    this.loadTrackingPageData();
  }

  trackByTour(_: number, tour: Tour): number {
    return tour.tourId ?? 0;
  }

  tourLabel(tour: Tour): string {
    const tourId = tour.tourId ?? '-';
    return `${this.i18n.t('liveTracking.tourLabel', { id: tourId })} - ${this.vehicleLabel(tour.vehicleId)}`;
  }

  vehicleLabel(vehicleId: number): string {
    const vehicle = this.vehicles().find((entry) => this.resolveVehicleId(entry) === vehicleId);
    if (!vehicle) {
      return this.i18n.t('liveTracking.vehicleFallback', { id: vehicleId });
    }

    const parts = [vehicle.mark?.trim(), vehicle.type?.trim()].filter((value): value is string => !!value);
    if (vehicle.plateNumber?.trim()) {
      parts.push(vehicle.plateNumber.trim());
    }

    return parts.join(' - ') || vehicle.vehicleCode?.trim() || this.i18n.t('liveTracking.vehicleFallback', { id: vehicleId });
  }

  markerVehicleLabel(vehicleId: number): string {
    const vehicle = this.vehicles().find((entry) => this.resolveVehicleId(entry) === vehicleId);
    if (!vehicle) {
      return this.i18n.t('liveTracking.vehicleFallback', { id: vehicleId });
    }

    const parts = [vehicle.mark?.trim(), vehicle.year?.toString(), vehicle.plateNumber?.trim()].filter(
      (value): value is string => !!value,
    );

    return parts.join(' - ') || vehicle.vehicleCode?.trim() || this.i18n.t('liveTracking.vehicleFallback', { id: vehicleId });
  }

  markerPlateLabel(vehicleId: number): string {
    const vehicle = this.vehicles().find((entry) => this.resolveVehicleId(entry) === vehicleId);
    return vehicle?.plateNumber?.trim() || vehicle?.vehicleCode?.trim() || this.i18n.t('liveTracking.vehicleFallback', { id: vehicleId });
  }

  statusLabel(status: TourStatus | string | null | undefined): string {
    if (status === 'start') {
      return this.i18n.t('common.statusStarted');
    }
    if (status === "didn't start") {
      return this.i18n.t('common.statusNotStarted');
    }
    if (status === 'end') {
      return this.i18n.t('common.statusEnded');
    }
    return status ?? '-';
  }

  formatLogTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(this.i18n.locale(), {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(parsed);
  }

  hasMapData(): boolean {
    return !!this.latestLog() && !this.locationUnavailable();
  }

  private loadTrackingPageData(): void {
    this.toursLoading.set(true);
    this.showToursLoading.set(false);
    this.toursError.set(false);
    this.toursLoadingIndicatorTimer?.unsubscribe();
    this.toursLoadingIndicatorTimer = timer(250)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.toursLoading()) {
          this.showToursLoading.set(true);
        }
      });

    forkJoin({
      tours: this.liveTrackingService.getTodayTours().pipe(
        timeout(15000),
        map((tours) => (Array.isArray(tours) ? tours : [])),
      ),
      vehicles: this.vehiclesService.getAll().pipe(
        timeout(15000),
        map((vehicles) => (Array.isArray(vehicles) ? vehicles : [])),
        catchError(() => of([])),
      ),
    })
      .subscribe({
        next: ({ tours, vehicles }) => {
          this.toursLoading.set(false);
          this.showToursLoading.set(false);
          this.toursLoadingIndicatorTimer?.unsubscribe();
          this.vehicles.set(vehicles ?? []);
          const startedTours = (tours ?? []).filter((tour) => this.isStartedTour(tour));
          this.startedTours.set(startedTours.filter((tour) => tour.tourId != null));

          if (startedTours.length > 0 && this.startedTours().length === 0) {
            this.selectedTour.set(null);
            this.toursError.set(true);
            this.filterForm.controls.tourId.setValue(null, { emitEvent: false });
            this.openSnack(this.i18n.t('liveTracking.resolveTourIdError'));
            return;
          }

          const selectedTourId = this.filterForm.controls.tourId.value;
          const stillValidSelection = this.startedTours().some((tour) => tour.tourId === selectedTourId);

          if (!stillValidSelection) {
            const defaultTourId = this.startedTours()[0]?.tourId ?? null;
            this.selectedTour.set(this.startedTours()[0] ?? null);
            this.filterForm.controls.tourId.setValue(defaultTourId);
            return;
          }

          this.selectedTour.set(this.startedTours().find((tour) => tour.tourId === selectedTourId) ?? null);
        },
        error: () => {
          this.toursLoading.set(false);
          this.showToursLoading.set(false);
          this.toursLoadingIndicatorTimer?.unsubscribe();
          this.startedTours.set([]);
          this.selectedTour.set(null);
          this.toursError.set(true);
          this.openSnack(this.i18n.t('liveTracking.loadTodayError'));
        },
      });
  }

  private bindTrackingStream(): void {
    this.filterForm.controls.tourId.valueChanges
      .pipe(
        startWith(this.filterForm.controls.tourId.value),
        distinctUntilChanged(),
        switchMap((tourId) => {
          this.handleTourSelectionChange(tourId);

          if (!tourId) {
            return of<LocationResult | null>(null);
          }

          return timer(0, 20_000).pipe(
            switchMap((tick) => {
              this.locationLoading.set(tick === 0);
              this.locationRefreshing.set(tick > 0);
              this.locationError.set(false);

              return this.fetchLatestLocation(tourId).pipe(
                finalize(() => {
                  this.locationLoading.set(false);
                  this.locationRefreshing.set(false);
                }),
              );
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }

        if (result.kind === 'error') {
          this.locationError.set(true);
          return;
        }

        if (result.kind === 'empty') {
          this.latestLog.set(null);
          this.lastLogTime = null;
          this.locationUnavailable.set(true);
          this.locationError.set(false);
          this.clearMarker();
          return;
        }

        this.locationUnavailable.set(false);
        this.locationError.set(false);

        const tourId = this.filterForm.controls.tourId.value;
        const shouldRecenter = this.lastCenteredTourId !== tourId;
        const hasNewLog = this.lastLogTime !== result.log.logTime;

        this.latestLog.set(result.log);

        if (hasNewLog || shouldRecenter || !this.marker) {
          this.updateMap(result.log, shouldRecenter);
        }

        this.lastLogTime = result.log.logTime;
      });
  }

  private fetchLatestLocation(tourId: number) {
    return this.liveTrackingService.getLatestGpsLog(tourId).pipe(
      map((log): LocationResult => {
        if (!log || log.latitude == null || log.longitude == null) {
          return { kind: 'empty' };
        }

        return { kind: 'data', log };
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404 || error.status === 204) {
          return of<LocationResult>({ kind: 'empty' });
        }

        return of<LocationResult>({ kind: 'error' });
      }),
    );
  }

  private handleTourSelectionChange(tourId: number | null): void {
    this.selectedTour.set(this.startedTours().find((tour) => tour.tourId === tourId) ?? null);
    this.latestLog.set(null);
    this.lastLogTime = null;
    this.lastCenteredTourId = null;
    this.locationUnavailable.set(false);
    this.locationError.set(false);
    this.locationLoading.set(!!tourId);
    this.locationRefreshing.set(false);
    this.clearMarker();
  }

  private initializeMap(): void {
    const container = this.mapContainer?.nativeElement;
    if (!container || this.map) {
      return;
    }

    this.map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
    }).setView([33.5731, -7.5898], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
  }

  private updateMap(log: LatestGpsLog, shouldRecenter: boolean): void {
    if (!this.map) {
      this.initializeMap();
    }

    const selectedTour = this.selectedTour();

    if (!this.map || !selectedTour) {
      return;
    }

    const position = L.latLng(log.latitude, log.longitude);

    if (!this.marker) {
      this.marker = L.marker(position, {
        icon: this.createVehicleIcon(),
        keyboard: true,
        riseOnHover: true,
      }).addTo(this.map);
    } else {
      this.marker.setLatLng(position);
    }

    this.marker
      .bindTooltip(this.escapeHtml(this.markerPlateLabel(selectedTour.vehicleId)), {
        permanent: true,
        direction: 'top',
        offset: L.point(0, -22),
        className: 'tracking-plate-tooltip',
      })
      .openTooltip();

    this.marker.bindPopup(
      this.buildMarkerPopup(selectedTour.vehicleId, log),
      {
        closeButton: true,
        autoClose: true,
        closeOnClick: true,
      },
    );

    if (shouldRecenter) {
      this.map.setView(position, 15, { animate: true });
      this.lastCenteredTourId = this.filterForm.controls.tourId.value;
    }
  }

  private clearMarker(): void {
    if (this.marker) {
      this.marker.remove();
      this.marker = undefined;
    }
  }

  private isStartedTour(tour: Tour): boolean {
    return tour.status === 'start';
  }

  private resolveVehicleId(vehicle: Vehicle): number | null {
    return vehicle.vehicleId ?? vehicle.id ?? null;
  }

  private openSnack(message: string): void {
    this.snackBar.open(message, this.i18n.t('common.closeAction'), {
      duration: 2600,
      horizontalPosition: 'start',
      verticalPosition: 'top',
    });
  }

  private createVehicleIcon(): L.DivIcon {
    return L.divIcon({
      className: 'tracking-car-marker',
      html: `
        <div class="tracking-car-marker__pin" aria-hidden="true">
          <svg viewBox="0 0 64 64" class="tracking-car-marker__icon" focusable="false">
            <path d="M17 39h30l-3.2-11.2A6 6 0 0 0 38 23H26a6 6 0 0 0-5.8 4.8z"></path>
            <path d="M13 39h38a5 5 0 0 1 5 5v7a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-2H18v2a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-7a5 5 0 0 1 5-5"></path>
            <circle cx="20" cy="48" r="4.5"></circle>
            <circle cx="44" cy="48" r="4.5"></circle>
            <path d="M23 30h18"></path>
          </svg>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 40],
      popupAnchor: [0, -34],
      tooltipAnchor: [0, -34],
    });
  }

  private buildMarkerPopup(vehicleId: number, log: LatestGpsLog): string {
    const vehicle = this.vehicles().find((entry) => this.resolveVehicleId(entry) === vehicleId);
    const mark = vehicle?.mark?.trim() || '-';
    const plateNumber = vehicle?.plateNumber?.trim() || vehicle?.vehicleCode?.trim() || '-';

    return `
      <div class="tracking-popup">
        <strong>${this.escapeHtml(this.markerVehicleLabel(vehicleId))}</strong>
        <div class="tracking-popup__row"><span>${this.escapeHtml(this.i18n.t('vehicles.mark'))}</span><b>${this.escapeHtml(mark)}</b></div>
        <div class="tracking-popup__row"><span>${this.escapeHtml(this.i18n.t('vehicles.plateNumber'))}</span><b>${this.escapeHtml(plateNumber)}</b></div>
        <div class="tracking-popup__time">${this.escapeHtml(this.formatLogTime(log.logTime))}</div>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
