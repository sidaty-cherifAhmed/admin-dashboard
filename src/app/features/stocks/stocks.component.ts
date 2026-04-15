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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, finalize } from 'rxjs';

import { Product } from '../../core/models/product.model';
import { Stock, StockPayload } from '../../core/models/stock.model';
import { I18nService } from '../../core/services/i18n.service';
import { ProductsService } from '../../core/services/products.service';
import { StocksService } from '../../core/services/stocks.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-stocks',
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
    TranslatePipe,
  ],
  templateUrl: './stocks.component.html',
  styleUrl: './stocks.component.scss',
})
export class StocksComponent implements OnInit {
  private readonly stocksService = inject(StocksService);
  private readonly productsService = inject(ProductsService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly i18n = inject(I18nService);
  displayedColumns: string[] = ['productName', 'quantity', 'actions'];
  dataSource = new MatTableDataSource<Stock>([]);
  readonly filterForm = this.fb.nonNullable.group({ search: [''] });
  readonly stockForm = this.fb.nonNullable.group({
    quantity: [0, [Validators.required, Validators.min(0)]],
    productId: [0, [Validators.required, Validators.min(1)]],
  });

  products: Product[] = [];
  loading = true;
  submitting = false;
  showForm = false;
  editingStockId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => {
      this.loadProducts();
      this.loadStocks();
    });
  }

  get isEditMode(): boolean {
    return this.editingStockId !== null;
  }

  loadStocks(): void {
    this.loading = true;
    this.stocksService.getAll().pipe(finalize(() => (this.loading = false))).subscribe({
      next: (stocks) => {
        this.dataSource.data = stocks ?? [];
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      },
      error: () => this.openSnack(this.i18n.t('stocks.loadError')),
    });
  }

  loadProducts(): void {
    this.productsService.getAll().subscribe({
      next: (products) => {
        this.products = products ?? [];
      },
      error: () => this.openSnack(this.i18n.t('stocks.loadProductsError')),
    });
  }

  openCreateStock(): void {
    this.showForm = true;
    this.editingStockId = null;
    this.stockForm.reset({ quantity: 0, productId: 0 });
  }

  openEditStock(stock: Stock): void {
    this.showForm = true;
    this.editingStockId = this.resolveStockId(stock);
    this.stockForm.patchValue({ quantity: stock.quantity, productId: stock.productId });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingStockId = null;
  }

  submitStock(): void {
    if (this.stockForm.invalid) {
      this.stockForm.markAllAsTouched();
      return;
    }

    const raw = this.stockForm.getRawValue();
    const payload: StockPayload = { quantity: Number(raw.quantity), productId: Number(raw.productId) };
    this.submitting = true;
    const request$ = this.isEditMode ? this.stocksService.update(this.editingStockId as number, payload) : this.stocksService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.i18n.t(this.isEditMode ? 'stocks.updateSuccess' : 'stocks.createSuccess'));
        this.closeForm();
        this.loadStocks();
      },
      error: () => this.openSnack(this.i18n.t(this.isEditMode ? 'stocks.updateError' : 'stocks.createError')),
    });
  }

  deleteStock(stock: Stock): void {
    const id = this.resolveStockId(stock);
    if (!id) {
      this.openSnack(this.i18n.t('stocks.resolveIdError'));
      return;
    }
    if (!confirm(this.i18n.t('stocks.deleteConfirm'))) {
      return;
    }
    this.stocksService.delete(id).subscribe({
      next: () => {
        this.openSnack(this.i18n.t('stocks.deleteSuccess'));
        this.loadStocks();
      },
      error: () => this.openSnack(this.i18n.t('stocks.deleteError')),
    });
  }

  productName(stock: Stock): string {
    return stock.productName || stock.product?.productName || this.productNameById(stock.productId);
  }

  productNameById(productId: number): string {
    return this.products.find((product) => (product.productId ?? product.id) === productId)?.productName ?? '-';
  }

  private resolveStockId(stock: Stock): number | null {
    return stock.stockId ?? stock.id ?? null;
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (stock, filter) =>
      [stock.quantity, this.productName(stock), stock.productId].join(' ').toLowerCase().includes(filter.trim().toLowerCase());

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
