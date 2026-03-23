import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, catchError, debounceTime, finalize, forkJoin, map, of, switchMap, throwError } from 'rxjs';

import { Product } from '../../core/models/product.model';
import { SalesPoint } from '../../core/models/salespoint.model';
import { Team } from '../../core/models/team.model';
import { TourItem, TourItemPayload } from '../../core/models/tour-item.model';
import { TourStop } from '../../core/models/tour-stop.model';
import { Tour, TourPayload } from '../../core/models/tour.model';
import { Vehicle } from '../../core/models/vehicle.model';
import { ProductsService } from '../../core/services/products.service';
import { SalesPointsService } from '../../core/services/salespoints.service';
import { TeamsService } from '../../core/services/teams.service';
import { TourItemsService } from '../../core/services/tour-items.service';
import { TourStopsService } from '../../core/services/tour-stops.service';
import { ToursService } from '../../core/services/tours.service';
import { VehiclesService } from '../../core/services/vehicles.service';

type TourStatusValue = "didn't start" | 'start' | 'end';

type TourItemFormGroup = FormGroup<{
  productId: FormControl<number>;
  loadedQt: FormControl<number>;
}>;

type TourFormGroup = FormGroup<{
  tourDate: FormControl<string>;
  vehicleId: FormControl<number>;
  teamId: FormControl<number>;
  status: FormControl<TourStatusValue>;
  salesPointIds: FormControl<number[]>;
  items: FormArray<TourItemFormGroup>;
}>;

interface TourSummary extends Tour {
  items: TourItem[];
  salesPoints: SalesPoint[];
  itemCount: number;
  totalLoadedQt: number;
}

interface SalesPointsDialogState {
  tourId: number;
  salesPoints: SalesPoint[];
}

@Component({
  selector: 'app-tours',
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
    MatSelectModule,
  ],
  templateUrl: './tours.component.html',
  styleUrl: './tours.component.scss',
})
export class ToursComponent implements OnInit {

  private readonly toursService = inject(ToursService);
  private readonly tourItemsService = inject(TourItemsService);
  private readonly tourStopsService = inject(TourStopsService);
  private readonly vehiclesService = inject(VehiclesService);
  private readonly teamsService = inject(TeamsService);
  private readonly productsService = inject(ProductsService);
  private readonly salesPointsService = inject(SalesPointsService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly statusOptions: ReadonlyArray<{ value: TourStatusValue; label: string }> = [
    { value: "didn't start", label: 'لم تبدأ' },
    { value: 'start', label: 'بدأت' },
    { value: 'end', label: 'انتهت' },
  ];

  displayedColumns: string[] = ['tourId', 'car', 'team', 'tourDate', 'status', 'salesPoints', 'details'];
  dataSource = new MatTableDataSource<TourSummary>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly tourForm: TourFormGroup = this.fb.nonNullable.group({
    tourDate: ['', [Validators.required]],
    vehicleId: [0, [Validators.required, Validators.min(1)]],
    teamId: [0, [Validators.required, Validators.min(1)]],
    status: ["didn't start" as TourStatusValue, [Validators.required]],
    salesPointIds: [[] as number[]],
    items: this.fb.nonNullable.array([this.createTourItemGroup()]),
  });

  vehicles: Vehicle[] = [];
  teams: Team[] = [];
  products: Product[] = [];
  salesPoints: SalesPoint[] = [];
  loading = true;
  submitting = false;
  showForm = false;
  duplicateProducts = false;
  selectedTourId: number | null = null;
  editingTourId: number | null = null;
  salesPointsDialog: SalesPointsDialogState | null = null;
  loadedItemNotes: Record<number, true> = {};

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    this.trackDuplicateProducts();
    queueMicrotask(() => {
      this.loadReferenceData();
      this.loadTours();
    });
  }

  get tourItemsControls(): TourItemFormGroup[] {
    return this.tourForm.controls.items.controls;
  }

  get selectedTour(): TourSummary | null {
    if (!this.selectedTourId) {
      return null;
    }

    return this.dataSource.data.find((tour) => this.resolveTourId(tour) === this.selectedTourId) ?? null;
  }

  get isEditMode(): boolean {
    return this.editingTourId !== null;
  }

  openCreateTour(): void {
    this.showForm = true;
    this.editingTourId = null;
    this.resetTourForm();
  }

  closeForm(): void {
    this.showForm = false;
    this.editingTourId = null;
    this.resetTourForm();
  }

  addTourItem(): void {
    this.tourForm.controls.items.push(this.createTourItemGroup());
    this.updateDuplicateProductsState();
  }

  removeTourItem(index: number): void {
    if (this.tourForm.controls.items.length === 1) {
      this.tourForm.controls.items.at(0).reset({
        productId: 0,
        loadedQt: 1,
      });
      this.updateDuplicateProductsState();
      return;
    }

    this.tourForm.controls.items.removeAt(index);
    this.updateDuplicateProductsState();
  }

  loadTours(): void {
    this.loading = true;
    forkJoin({
      tours: this.toursService.getAll(),
      tourItems: this.tourItemsService.getAll(),
    })
      .pipe(
        switchMap(({ tours, tourItems }) => {
          const summaryRequests = (tours ?? []).map((tour) =>
            this.loadTourSalesPoints(tour).pipe(map((salesPoints) => this.toSummary(tour, tourItems ?? [], salesPoints))),
          );

          return summaryRequests.length ? forkJoin(summaryRequests) : of([]);
        }),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (tours) => {
          this.dataSource.data = tours ?? [];
          if (this.selectedTourId && !this.selectedTour) {
            this.selectedTourId = null;
          }
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => {
          this.openSnack('فشل تحميل الجولات');
        },
      });
  }

  submitTour(): void {
    if (this.tourForm.invalid) {
      this.tourForm.markAllAsTouched();
      return;
    }

    if (this.duplicateProducts) {
      this.openSnack('لا يمكن تكرار نفس المنتج داخل الجولة نفسها');
      return;
    }

    const raw = this.tourForm.getRawValue();
    const payload: TourPayload = {
      tourDate: this.normalizeTourDateForApi(raw.tourDate),
      vehicleId: Number(raw.vehicleId),
      teamId: Number(raw.teamId),
      status: raw.status,
    };
    console.log(raw.tourDate);
    const salesPointIds = raw.salesPointIds.map((id) => Number(id)).filter((id) => id > 0);
    const itemsPayload: Omit<TourItemPayload, 'tourId'>[] = raw.items.map((item) => ({
      loadedQt: Number(item.loadedQt),
      productId: Number(item.productId),
    }));

    this.submitting = true;
    const request$ = this.isEditMode
      ? this.updateTourWithRelations(this.editingTourId as number, payload, itemsPayload, salesPointIds)
      : this.createTourWithRelations(payload, itemsPayload, salesPointIds);

    request$
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.openSnack(this.isEditMode ? 'تم تعديل الجولة وعناصرها ونقاط البيع' : 'تم إنشاء الجولة وعناصرها ونقاط البيع');
          this.closeForm();
          this.loadTours();
        },
        error: () => {
          this.openSnack(this.isEditMode ? 'فشل تعديل الجولة' : 'فشل إنشاء الجولة');
        },
      });
  }

  vehicleLabel(vehicleId: number): string {
    const vehicle = this.vehicles.find((entry) => this.resolveVehicleId(entry) === vehicleId);
    if (!vehicle) {
      return `#${vehicleId}`;
    }

    return `${vehicle.plateNumber}`;
  }

  vehicleModelLabel(vehicleId: number): string {
    const vehicle = this.vehicles.find((entry) => this.resolveVehicleId(entry) === vehicleId);
    if (!vehicle) {
      return `#${vehicleId}`;
    }

    return vehicle.model?.trim() || vehicle.vehicleCode;
  }

  teamLabel(teamId: number): string {
    return this.teams.find((entry) => this.resolveTeamId(entry) === teamId)?.teamName ?? `#${teamId}`;
  }

  productLabel(productId: number): string {
    const product = this.products.find((entry) => this.resolveProductId(entry) === productId);
    if (!product) {
      return `#${productId}`;
    }

    return `${product.productName} (${product.productCode})`;
  }

  salesPointsLabel(tour: TourSummary): string {
    if (tour.salesPoints.length === 0) {
      return '-';
    }

    return tour.salesPoints.map((point) => point.name).join('، ');
  }

  statusLabel(status: string | null | undefined): string {
    const normalized = (status ?? '').trim().toLowerCase();
    return this.statusOptions.find((option) => option.value === normalized)?.label ?? status ?? '-';
  }

  canDeleteTour(tour: TourSummary): boolean {
    return !this.isStartedTour(tour);
  }

  toggleDetails(tour: TourSummary): void {
    const tourId = this.resolveTourId(tour);
    if (!tourId) {
      return;
    }

    const willOpen = this.selectedTourId !== tourId;
    this.selectedTourId = willOpen ? tourId : null;

    if (willOpen) {
      this.loadItemNotes(tour.items);
    }
  }

  hasOpenDetails(tour: TourSummary): boolean {
    return this.resolveTourId(tour) === this.selectedTourId;
  }

  openSalesPointsDialog(tour: TourSummary): void {
    const tourId = this.resolveTourId(tour);
    if (!tourId) {
      this.openSnack('تعذر تحديد معرف الجولة');
      return;
    }

    this.salesPointsDialog = {
      tourId,
      salesPoints: tour.salesPoints,
    };
  }

  closeSalesPointsDialog(): void {
    this.salesPointsDialog = null;
  }

  salesPointStatusLabel(isActive: boolean): string {
    return isActive ? 'نشطة' : 'غير نشطة';
  }

  openEditTour(tour: TourSummary): void {
    const tourId = this.resolveTourId(tour);
    if (!tourId) {
      this.openSnack('تعذر تحديد معرف الجولة');
      return;
    }

    this.editingTourId = tourId;
    this.showForm = true;
    this.selectedTourId = tourId;
    this.loadItemNotes(tour.items);
    this.setTourItemsForm(tour.items);
    this.tourForm.patchValue({
      tourDate: this.toDateInputValue(tour.tourDate),
      vehicleId: tour.vehicleId,
      teamId: tour.teamId,
      status: this.normalizeStatus(tour.status),
      salesPointIds: tour.salesPoints.map((point) => this.resolveSalesPointId(point)).filter((id): id is number => id !== null),
    });
    this.updateDuplicateProductsState();
  }

  deleteTour(tour: TourSummary): void {
    const tourId = this.resolveTourId(tour);
    if (!tourId) {
      this.openSnack('تعذر تحديد معرف الجولة');
      return;
    }

    if (!this.canDeleteTour(tour)) {
      this.openSnack('لا يمكن حذف جولة حالتها بدأت');
      return;
    }

    if (!confirm('هل أنت متأكد من حذف هذه الجولة؟')) {
      return;
    }

    this.deleteTourStops(tourId)
      .pipe(
        switchMap(() => this.deleteTourItems(tour.items)),
        switchMap(() => this.toursService.delete(tourId)),
      )
      .subscribe({
        next: () => {
          if (this.selectedTourId === tourId) {
            this.selectedTourId = null;
          }
          if (this.editingTourId === tourId) {
            this.closeForm();
          }
          if (this.salesPointsDialog?.tourId === tourId) {
            this.closeSalesPointsDialog();
          }
          this.openSnack('تم حذف الجولة');
          this.loadTours();
        },
        error: () => {
          this.openSnack('فشل حذف الجولة');
        },
      });
  }

  trackByIndex(index: number): number {
    return index;
  }

  hasItemNote(item: TourItem): boolean {
    const note = item.note?.trim();
    return !!note;
  }

  hasLoadedItemNote(item: TourItem): boolean {
    const itemId = this.resolveTourItemId(item);
    return itemId ? this.loadedItemNotes[itemId] === true : false;
  }

  private createTourItemGroup(): TourItemFormGroup {
    return this.fb.nonNullable.group({
      productId: [0, [Validators.required, Validators.min(1)]],
      loadedQt: [1, [Validators.required, Validators.min(1)]],
    });
  }

  private createTourWithRelations(
    payload: TourPayload,
    itemsPayload: Omit<TourItemPayload, 'tourId'>[],
    salesPointIds: number[],
  ): Observable<Tour> {
    return this.toursService.create(payload).pipe(
      switchMap((tour) => {
        const tourId = this.resolveTourId(tour);
        if (!tourId) {
          return throwError(() => new Error('Missing tour id'));
        }

        return this.createTourItems(tourId, itemsPayload).pipe(
          switchMap(() => this.replaceTourStops(tourId, salesPointIds)),
          map(() => tour),
        );
      }),
    );
  }

  private updateTourWithRelations(
    tourId: number,
    payload: TourPayload,
    itemsPayload: Omit<TourItemPayload, 'tourId'>[],
    salesPointIds: number[],
  ): Observable<Tour> {
    const existingTour = this.dataSource.data.find((tour) => this.resolveTourId(tour) === tourId);
    const existingItems = existingTour?.items ?? [];

    return this.toursService.update(tourId, payload).pipe(
      switchMap((tour) =>
        this.deleteTourItems(existingItems).pipe(
          switchMap(() => this.createTourItems(tourId, itemsPayload)),
          switchMap(() => this.replaceTourStops(tourId, salesPointIds)),
          map(() => tour),
        ),
      ),
    );
  }

  private createTourItems(
    tourId: number,
    itemsPayload: Omit<TourItemPayload, 'tourId'>[],
  ): Observable<TourItem[]> {
    if (itemsPayload.length === 0) {
      return of([]);
    }

    return forkJoin(
      itemsPayload.map((item) =>
        this.tourItemsService.create({
          ...item,
          tourId,
        }),
      ),
    );
  }

  private replaceTourStops(tourId: number, salesPointIds: number[]): Observable<unknown> {
    return this.deleteTourStops(tourId).pipe(switchMap(() => this.createTourStops(tourId, salesPointIds)));
  }

  private createTourStops(tourId: number, salesPointIds: number[]): Observable<unknown[]> {
    const uniqueSalesPointIds = [...new Set(salesPointIds)];
    if (uniqueSalesPointIds.length === 0) {
      return of([]);
    }

    return forkJoin(
      uniqueSalesPointIds.map((salesPointId) =>
        this.tourStopsService.create({
          tourId,
          salesPointId,
        }),
      ),
    );
  }

  private deleteTourStops(tourId: number): Observable<unknown[]> {
    return this.tourStopsService.getAll().pipe(
      switchMap((tourStops) => {
        const requests = (tourStops ?? [])
          .filter((tourStop) => tourStop.tourId === tourId)
          .map((tourStop) => this.resolveTourStopId(tourStop))
          .filter((id): id is number => id !== null)
          .map((id) => this.tourStopsService.delete(id));

        return requests.length ? forkJoin(requests) : of([]);
      }),
    );
  }

  private deleteTourItems(items: TourItem[]): Observable<unknown[]> {
    const requests = items
      .map((item) => this.resolveTourItemId(item))
      .filter((id): id is number => id !== null)
      .map((id) => this.tourItemsService.delete(id));

    if (requests.length === 0) {
      return of([]);
    }

    return forkJoin(requests);
  }

  private loadReferenceData(): void {
    this.vehiclesService.getAll().subscribe({
      next: (vehicles) => {
        this.vehicles = vehicles ?? [];
      },
      error: () => {
        this.openSnack('فشل تحميل المركبات');
      },
    });

    this.teamsService.getAll().subscribe({
      next: (teams) => {
        this.teams = teams ?? [];
      },
      error: () => {
        this.openSnack('فشل تحميل الفرق');
      },
    });

    this.productsService.getAll().subscribe({
      next: (products) => {
        this.products = products ?? [];
      },
      error: () => {
        this.openSnack('فشل تحميل المنتجات');
      },
    });

    this.salesPointsService.getAll().subscribe({
      next: (salesPoints) => {
        this.salesPoints = salesPoints ?? [];
      },
      error: () => {
        this.openSnack('فشل تحميل نقاط البيع');
      },
    });
  }

  private loadTourSalesPoints(tour: Tour): Observable<SalesPoint[]> {
    const tourId = this.resolveTourId(tour);
    if (!tourId) {
      return of([]);
    }

    return this.toursService.getSalesPoints(tourId).pipe(catchError(() => of([])));
  }

  private toSummary(tour: Tour, allItems: TourItem[], salesPoints: SalesPoint[]): TourSummary {
    const tourId = this.resolveTourId(tour);
    const items = tourId ? allItems.filter((item) => item.tourId === tourId) : [];

    return {
      ...tour,
      items,
      salesPoints,
      itemCount: items.length,
      totalLoadedQt: items.reduce((total, item) => total + item.loadedQt, 0),
    };
  }

  private resetTourForm(): void {
    while (this.tourForm.controls.items.length > 1) {
      this.tourForm.controls.items.removeAt(this.tourForm.controls.items.length - 1);
    }

    this.tourForm.reset({
      tourDate: '',
      vehicleId: 0,
      teamId: 0,
      status: "didn't start",
      salesPointIds: [],
      items: [
        {
          productId: 0,
          loadedQt: 1,
        },
      ],
    });
    this.updateDuplicateProductsState();
  }

  private setTourItemsForm(items: TourItem[]): void {
    this.tourForm.controls.items.clear();

    if (items.length === 0) {
      this.tourForm.controls.items.push(this.createTourItemGroup());
      return;
    }

    items.forEach((item) => {
      this.tourForm.controls.items.push(
        this.fb.nonNullable.group({
          productId: [item.productId, [Validators.required, Validators.min(1)]],
          loadedQt: [item.loadedQt, [Validators.required, Validators.min(1)]],
        }),
      );
    });
  }

  private normalizeStatus(status: string | null | undefined): TourStatusValue {
    const normalized = (status ?? '').trim().toLowerCase() as TourStatusValue;
    return this.statusOptions.some((option) => option.value === normalized) ? normalized : "didn't start";
  }

  private toDateInputValue(value: string | null | undefined): string {
    const raw = (value ?? '').trim();
    if (!raw) {
      return '';
    }

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, first, second] = isoMatch;
      const firstNumber = Number(first);
      const secondNumber = Number(second);

      if (firstNumber >= 1 && firstNumber <= 12) {
        return `${year}-${first}-${second}`;
      }

      if (secondNumber >= 1 && secondNumber <= 12) {
        return `${year}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
      }
    }

    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return raw;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeTourDateForApi(value: string | null | undefined): string {
    return this.toDateInputValue(value);
  }

  private resolveTourId(tour: Tour): number | null {
    return tour.tourId ?? tour.id ?? null;
  }

  private resolveVehicleId(vehicle: Vehicle): number | null {
    return vehicle.vehicleId ?? vehicle.id ?? null;
  }

  private resolveTourItemId(item: TourItem): number | null {
    return item.tourItemId ?? item.id ?? null;
  }

  private resolveTourStopId(tourStop: TourStop): number | null {
    return tourStop.tourStopId ?? tourStop.id ?? null;
  }

  private resolveTeamId(team: Team): number | null {
    return team.teamId ?? null;
  }

  private resolveProductId(product: Product): number | null {
    return product.productId ?? product.id ?? null;
  }

  private resolveSalesPointId(point: SalesPoint): number | null {
    return point.salesPointId ?? point.id ?? null;
  }

  private trackDuplicateProducts(): void {
    this.tourForm.controls.items.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateDuplicateProductsState());
  }

  private updateDuplicateProductsState(): void {
    const selectedProductIds = this.tourForm.controls.items.controls
      .map((control) => Number(control.controls.productId.value))
      .filter((productId) => productId > 0);

    this.duplicateProducts = new Set(selectedProductIds).size !== selectedProductIds.length;
  }

  private isStartedTour(tour: Tour): boolean {
    return (tour.status ?? '').trim().toLowerCase() === 'start';
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (tour, filter) => {
      const text = filter.trim().toLowerCase();
      return [
        tour.tourDate,
        this.resolveTourId(tour),
        tour.vehicleId,
        tour.teamId,
        tour.status ?? '',
        this.statusLabel(tour.status),
        this.vehicleLabel(tour.vehicleId),
        this.vehicleModelLabel(tour.vehicleId),
        this.teamLabel(tour.teamId),
        ...tour.salesPoints.map((point) => point.name),
        ...tour.items.map((item) => this.productLabel(item.productId)),
        ...tour.items.map((item) => item.loadedQt),
      ]
        .join(' ')
        .toLowerCase()
        .includes(text);
    };

    this.filterForm.controls.search.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.dataSource.filter = value.trim().toLowerCase();
        this.dataSource.paginator?.firstPage();
      });
  }

  private loadItemNotes(items: TourItem[]): void {
    const requests = items
      .map((item) => ({ item, itemId: this.resolveTourItemId(item) }))
      .filter(
        (entry): entry is { item: TourItem; itemId: number } =>
          entry.itemId !== null && this.loadedItemNotes[entry.itemId] !== true,
      )
      .map(({ item, itemId }) =>
        this.tourItemsService.getNote(itemId).pipe(
          map((note) => ({ item, itemId, note })),
          catchError(() => of({ item, itemId, note: null })),
        ),
      );

    if (requests.length === 0) {
      return;
    }

    forkJoin(requests).subscribe((results) => {
      results.forEach(({ item, note }) => {
        item.note = note;
      });

      this.loadedItemNotes = {
        ...this.loadedItemNotes,
        ...Object.fromEntries(results.map(({ itemId }) => [itemId, true])),
      };
      this.dataSource.data = [...this.dataSource.data];
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
