import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';

import { Vehicle, VehiclePayload } from '../../core/models/vehicle.model';
import { VehiclesService } from '../../core/services/vehicles.service';
import { debounceTime } from 'rxjs';

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
  ],
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.scss',
})
export class VehiclesComponent implements OnInit {
  private readonly vehiclesService = inject(VehiclesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  displayedColumns: string[] = ['vehicleCode', 'plateNumber', 'capacity', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<Vehicle>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly vehicleForm = this.fb.nonNullable.group({
    vehicleCode: ['', [Validators.required, Validators.minLength(2)]],
    plateNumber: ['', [Validators.required, Validators.minLength(2)]],
    capacity: [1, [Validators.required, Validators.min(1)]],
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
    queueMicrotask(() => {
      this.loadVehicles();
    });
  }

  get isEditMode(): boolean {
    return this.editingVehicleId !== null;
  }

  loadVehicles(): void {
    this.loading = true;
    this.vehiclesService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (vehicles) => {
          this.dataSource.data = vehicles ?? [];
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => {
          this.openSnack('فشل تحميل المركبات');
        },
      });
  }

  openCreateVehicle(): void {
    this.showForm = true;
    this.editingVehicleId = null;
    this.vehicleForm.reset({
      vehicleCode: '',
      plateNumber: '',
      capacity: 1,
      isActive: true,
    });
  }

  openEditVehicle(vehicle: Vehicle): void {
    this.showForm = true;
    this.editingVehicleId = this.resolveVehicleId(vehicle);
    this.vehicleForm.patchValue({
      vehicleCode: vehicle.vehicleCode,
      plateNumber: vehicle.plateNumber,
      capacity: vehicle.capacity,
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
      plateNumber: raw.plateNumber.trim(),
      capacity: Number(raw.capacity),
      isActive: raw.isActive,
    };

    this.submitting = true;
    const request$ = this.isEditMode
      ? this.vehiclesService.update(this.editingVehicleId as number, payload)
      : this.vehiclesService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.isEditMode ? 'تم تعديل المركبة' : 'تم إنشاء المركبة');
        this.closeForm();
        this.loadVehicles();
      },
      error: () => {
        this.openSnack(this.isEditMode ? 'فشل تعديل المركبة' : 'فشل إنشاء المركبة');
      },
    });
    
  }

  deleteVehicle(vehicle: Vehicle): void {
    const id = this.resolveVehicleId(vehicle);
    if (!id) {
      this.openSnack('تعذر تحديد معرف المركبة');
      return;
    }

    if (!confirm('هل أنت متأكد من حذف هذه المركبة؟')) {
      return;
    }

    this.vehiclesService.delete(id).subscribe({
      next: () => {
        this.openSnack('تم حذف المركبة');
        this.loadVehicles();
      },
      error: () => {
        this.openSnack('فشل حذف المركبة');
      },
    });
  }

  private resolveVehicleId(vehicle: Vehicle): number | null {
    return vehicle.vehicleId ?? vehicle.id ?? null;
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (vehicle, filter) => {
      const text = filter.trim().toLowerCase();
      return [
        vehicle.vehicleCode,
        vehicle.plateNumber,
        vehicle.capacity,
        vehicle.isActive ? 'نشط' : 'غير نشط',
      ]
        .join(' ')
        .toLowerCase()
        .includes(text);
    };

    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(300),takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.dataSource.filter = value.trim().toLowerCase();
        this.dataSource.paginator?.firstPage();
      });
  }

  private openSnack(message: string): void {
    this.snackBar.open(message, 'إغلاق', {
      duration: 2600,
      horizontalPosition: 'start',
      verticalPosition: 'top',
    });
  }
}
