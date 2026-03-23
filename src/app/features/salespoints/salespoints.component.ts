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

import { SalesPoint, SalesPointPayload } from '../../core/models/salespoint.model';
import { SalesPointsService } from '../../core/services/salespoints.service';
import { debounceTime } from 'rxjs';

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
  ],
  templateUrl: './salespoints.component.html',
  styleUrl: './salespoints.component.scss',
})
export class SalesPointsComponent implements OnInit {

  private readonly salesPointsService = inject(SalesPointsService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);


  displayedColumns: string[] = ['name', 'zone', 'adresse', 'coordinates', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<SalesPoint>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

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
    queueMicrotask(() => {
      this.loadSalesPoints();
    });
  }

  get isEditMode(): boolean {
    return this.editingSalesPointId !== null;
  }

  loadSalesPoints(): void {
    this.loading = true;
    this.salesPointsService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (salesPoints) => {
          this.dataSource.data = salesPoints ?? [];
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => {
          this.openSnack('فشل تحميل نقاط البيع');
        },
      });
  }

  openCreateSalesPoint(): void {
    this.showForm = true;
    this.editingSalesPointId = null;
    this.salesPointForm.reset({
      name: '',
      adresse: '',
      zone: '',
      gpsLatitude: 0,
      gpsLongitude: 0,
      isActive: true,
    });
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
      this.openSnack('المتصفح لا يدعم تحديد الموقع');
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
        this.openSnack('تم تعبئة الإحداثيات الحالية');
      },
      () => {
        this.locating = false;
        this.openSnack('فشل تحديد الموقع الحالي');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
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
    const request$ = this.isEditMode
      ? this.salesPointsService.update(this.editingSalesPointId as number, payload)
      : this.salesPointsService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.isEditMode ? 'تم تعديل نقطة البيع' : 'تم إنشاء نقطة البيع');
        this.closeForm();
        this.loadSalesPoints();
      },
      error: () => {
        this.openSnack(this.isEditMode ? 'فشل تعديل نقطة البيع' : 'فشل إنشاء نقطة البيع');
      },
    });
  }

  deleteSalesPoint(point: SalesPoint): void {
    const id = this.resolveSalesPointId(point);
    if (!id) {
      this.openSnack('تعذر تحديد معرف نقطة البيع');
      return;
    }

    if (!confirm('هل أنت متأكد من حذف نقطة البيع هذه؟')) {
      return;
    }

    this.salesPointsService.delete(id).subscribe({
      next: () => {
        this.openSnack('تم حذف نقطة البيع');
        this.loadSalesPoints();
      },
      error: () => {
        this.openSnack('فشل حذف نقطة البيع');
      },
    });
  }

  private resolveSalesPointId(point: SalesPoint): number | null {
    return point.salesPointId ?? point.id ?? null;
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (point, filter) => {
      const text = filter.trim().toLowerCase();
      return [
        point.name,
        point.zone,
        point.adresse,
        point.gpsLatitude,
        point.gpsLongitude,
        point.isActive ? 'نشط' : 'غير نشط',
      ]
        .join(' ')
        .toLowerCase()
        .includes(text);
    };

    this.filterForm.controls.search.valueChanges
      .pipe( debounceTime(300),takeUntilDestroyed(this.destroyRef))
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
