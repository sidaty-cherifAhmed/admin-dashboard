import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, finalize } from 'rxjs';

import { SalesPoint, SalesPointPayload } from '../../core/models/salespoint.model';
import { I18nService } from '../../core/services/i18n.service';
import { SalesPointsService } from '../../core/services/salespoints.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-salespoints',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatCardModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    TranslatePipe,
  ],
  templateUrl: './salespoints.component.html',
  styleUrl: './salespoints.component.scss',
})
export class SalesPointsComponent implements OnInit {
  private readonly salesPointsService = inject(SalesPointsService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly i18n = inject(I18nService);
  displayedColumns: string[] = ['name', 'zone', 'adresse', 'coordinates', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<SalesPoint>([]);
  readonly filterForm = this.fb.nonNullable.group({ search: [''] });
  readonly salesPointForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    adresse: ['', [Validators.required, Validators.minLength(3)]],
    zone: ['', [Validators.required, Validators.minLength(2)]],
    gpsLatitude: [0, [Validators.required, Validators.min(-90), Validators.max(90)]],
    gpsLongitude: [0, [Validators.required, Validators.min(-180), Validators.max(180)]],
    isActive: [true],
  });

  loading = true;
  submitting = false;
  locating = false;
  showForm = false;
  editingSalesPointId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => this.loadSalesPoints());
  }

  get isEditMode(): boolean {
    return this.editingSalesPointId !== null;
  }

  loadSalesPoints(): void {
    this.loading = true;
    this.salesPointsService.getAll().pipe(finalize(() => (this.loading = false))).subscribe({
      next: (salesPoints) => {
        this.dataSource.data = salesPoints ?? [];
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      },
      error: () => this.openSnack(this.i18n.t('salespoints.loadError')),
    });
  }

  openCreateSalesPoint(): void {
    this.showForm = true;
    this.editingSalesPointId = null;
    this.salesPointForm.reset({ name: '', adresse: '', zone: '', gpsLatitude: 0, gpsLongitude: 0, isActive: true });
  }

  openEditSalesPoint(point: SalesPoint): void {
    this.showForm = true;
    this.editingSalesPointId = this.resolveSalesPointId(point);
    this.salesPointForm.patchValue({
      name: point.name,
      adresse: point.adresse,
      zone: point.zone,
      gpsLatitude: point.gpsLatitude,
      gpsLongitude: point.gpsLongitude,
      isActive: point.isActive,
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingSalesPointId = null;
  }

  fillCurrentCoordinates(): void {
    if (this.locating) {
      return;
    }
    if (!('geolocation' in navigator)) {
      this.openSnack(this.i18n.t('salespoints.geoUnsupported'));
      return;
    }
    this.locating = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.salesPointForm.patchValue({
          gpsLatitude: Number(position.coords.latitude.toFixed(6)),
          gpsLongitude: Number(position.coords.longitude.toFixed(6)),
        });
        this.salesPointForm.controls.gpsLatitude.markAsTouched();
        this.salesPointForm.controls.gpsLongitude.markAsTouched();
        this.locating = false;
        this.openSnack(this.i18n.t('salespoints.geoSuccess'));
      },
      () => {
        this.locating = false;
        this.openSnack(this.i18n.t('salespoints.geoError'));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  submitSalesPoint(): void {
    if (this.salesPointForm.invalid) {
      this.salesPointForm.markAllAsTouched();
      return;
    }
    const raw = this.salesPointForm.getRawValue();
    const payload: SalesPointPayload = {
      name: raw.name.trim(),
      adresse: raw.adresse.trim(),
      zone: raw.zone.trim(),
      gpsLatitude: Number(raw.gpsLatitude),
      gpsLongitude: Number(raw.gpsLongitude),
      isActive: raw.isActive,
    };

    this.submitting = true;
    const request$ = this.isEditMode ? this.salesPointsService.update(this.editingSalesPointId as number, payload) : this.salesPointsService.create(payload);
    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.i18n.t(this.isEditMode ? 'salespoints.updateSuccess' : 'salespoints.createSuccess'));
        this.closeForm();
        this.loadSalesPoints();
      },
      error: () => this.openSnack(this.i18n.t(this.isEditMode ? 'salespoints.updateError' : 'salespoints.createError')),
    });
  }

  deleteSalesPoint(point: SalesPoint): void {
    const id = this.resolveSalesPointId(point);
    if (!id) {
      this.openSnack(this.i18n.t('salespoints.resolveIdError'));
      return;
    }
    if (!confirm(this.i18n.t('salespoints.deleteConfirm'))) {
      return;
    }
    this.salesPointsService.delete(id).subscribe({
      next: () => {
        this.openSnack(this.i18n.t('salespoints.deleteSuccess'));
        this.loadSalesPoints();
      },
      error: () => this.openSnack(this.i18n.t('salespoints.deleteError')),
    });
  }

  private resolveSalesPointId(point: SalesPoint): number | null {
    return point.salesPointId ?? point.id ?? null;
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (point, filter) =>
      [point.name, point.zone, point.adresse, point.gpsLatitude, point.gpsLongitude, point.isActive ? this.i18n.t('common.active') : this.i18n.t('common.inactive')]
        .join(' ')
        .toLowerCase()
        .includes(filter.trim().toLowerCase());

    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.dataSource.filter = value.trim().toLowerCase();
        this.dataSource.paginator?.firstPage();
      });
  }

  private openSnack(message: string): void {
    this.snackBar.open(message, this.i18n.t('common.closeAction'), {
      duration: 2600,
      horizontalPosition: 'start',
      verticalPosition: 'top',
    });
  }
}
