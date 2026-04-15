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

import { I18nService } from '../../core/services/i18n.service';
import { Vehicle, VehiclePayload } from '../../core/models/vehicle.model';
import { VehiclesService } from '../../core/services/vehicles.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-vehicles',
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
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.scss',
})
export class VehiclesComponent implements OnInit {
  private readonly vehiclesService = inject(VehiclesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly i18n = inject(I18nService);
  displayedColumns: string[] = ['vehicleCode', 'mark', 'type', 'year', 'plateNumber', 'capacity', 'mileage', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<Vehicle>([]);
  readonly filterForm = this.fb.nonNullable.group({ search: [''] });
  readonly vehicleForm = this.fb.nonNullable.group({
    vehicleCode: ['', [Validators.required, Validators.minLength(2)]],
    plateNumber: [''],
    capacity: [null as number | null],
    mark: [''],
    type: [''],
    year: [null as number | null],
    mileage: [null as number | null],
    isActive: [true],
  });

  loading = true;
  submitting = false;
  showForm = false;
  editingVehicleId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => this.loadVehicles());
  }

  get isEditMode(): boolean {
    return this.editingVehicleId !== null;
  }

  loadVehicles(): void {
    this.loading = true;
    this.vehiclesService.getAll().pipe(finalize(() => (this.loading = false))).subscribe({
      next: (vehicles) => {
        this.dataSource.data = vehicles ?? [];
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      },
      error: () => this.openSnack(this.i18n.t('vehicles.loadError')),
    });
  }

  openCreateVehicle(): void {
    this.showForm = true;
    this.editingVehicleId = null;
    this.vehicleForm.reset({
      vehicleCode: '',
      plateNumber: '',
      capacity: null,
      mark: '',
      type: '',
      year: null,
      mileage: null,
      isActive: true,
    });
  }

  openEditVehicle(vehicle: Vehicle): void {
    this.showForm = true;
    this.editingVehicleId = this.resolveVehicleId(vehicle);
    this.vehicleForm.patchValue({
      vehicleCode: vehicle.vehicleCode,
      plateNumber: vehicle.plateNumber ?? '',
      capacity: vehicle.capacity ?? null,
      mark: vehicle.mark ?? '',
      type: vehicle.type ?? '',
      year: vehicle.year ?? null,
      mileage: vehicle.mileage ?? null,
      isActive: vehicle.isActive,
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingVehicleId = null;
  }

  submitVehicle(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    const raw = this.vehicleForm.getRawValue();
    const payload: VehiclePayload = {
      vehicleCode: raw.vehicleCode.trim(),
      isActive: raw.isActive,
    };
    const plateNumber = raw.plateNumber.trim();
    const mark = raw.mark.trim();
    const type = raw.type.trim();

    if (plateNumber) {
      payload.plateNumber = plateNumber;
    }
    if (raw.capacity != null) {
      payload.capacity = Number(raw.capacity);
    }
    if (mark) {
      payload.mark = mark;
    }
    if (type) {
      payload.type = type;
    }
    if (raw.year != null) {
      payload.year = Number(raw.year);
    }
    if (raw.mileage != null) {
      payload.mileage = Number(raw.mileage);
    }

    this.submitting = true;
    const request$ = this.isEditMode
      ? this.vehiclesService.update(this.editingVehicleId as number, payload)
      : this.vehiclesService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.i18n.t(this.isEditMode ? 'vehicles.updateSuccess' : 'vehicles.createSuccess'));
        this.closeForm();
        this.loadVehicles();
      },
      error: () => this.openSnack(this.i18n.t(this.isEditMode ? 'vehicles.updateError' : 'vehicles.createError')),
    });
  }

  deleteVehicle(vehicle: Vehicle): void {
    const id = this.resolveVehicleId(vehicle);
    if (!id) {
      this.openSnack(this.i18n.t('vehicles.resolveIdError'));
      return;
    }
    if (!confirm(this.i18n.t('vehicles.deleteConfirm'))) {
      return;
    }
    this.vehiclesService.delete(id).subscribe({
      next: () => {
        this.openSnack(this.i18n.t('vehicles.deleteSuccess'));
        this.loadVehicles();
      },
      error: () => this.openSnack(this.i18n.t('vehicles.deleteError')),
    });
  }

  private resolveVehicleId(vehicle: Vehicle): number | null {
    return vehicle.vehicleId ?? vehicle.id ?? null;
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (vehicle, filter) =>
      [
        vehicle.vehicleCode,
        vehicle.plateNumber,
        vehicle.capacity,
        vehicle.mark,
        vehicle.type,
        vehicle.year,
        vehicle.mileage,
        vehicle.isActive ? this.i18n.t('common.active') : this.i18n.t('common.inactive'),
      ]
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
