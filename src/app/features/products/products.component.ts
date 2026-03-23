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
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { Category } from '../../core/models/category.model';
import { Product, ProductPayload } from '../../core/models/product.model';
import { CategoriesService } from '../../core/services/categories.service';
import { ProductsService } from '../../core/services/products.service';
import { debounceTime } from 'rxjs';

@Component({
  selector: 'app-products',
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
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent implements OnInit {

  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);

  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);


  displayedColumns: string[] = [
    'productCode',
    'productName',
    'unitPrice',
    'shelfLifeDate',
    'categoryName',
    'actions',
  ];

  dataSource = new MatTableDataSource<Product>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly productForm = this.fb.nonNullable.group({
    productCode: ['', [Validators.required, Validators.minLength(2)]],
    productName: ['', [Validators.required, Validators.minLength(2)]],
    unitPrice: [0, [Validators.required, Validators.min(0.01)]],
    shelfLifeDate: ['', [Validators.required]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
  });

  categories: Category[] = [];
  loading = true;
  submitting = false;
  showForm = false;
  editingProductId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => {
      this.loadCategories();
      this.loadProducts();
    });
  }

  get isEditMode(): boolean {
    return this.editingProductId !== null;
  }

  loadProducts(): void {
    this.loading = true;
    this.productsService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (products) => {
          this.dataSource.data = products ?? [];
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => {
          this.openSnack('فشل تحميل المنتجات');
        },
      });
  }

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (categories) => {
        this.categories = categories ?? [];
      },
      error: () => {
        this.openSnack('فشل تحميل التصنيفات');
      },
    });
  }

  openCreateProduct(): void {
    this.showForm = true;
    this.editingProductId = null;
    this.productForm.reset({
      productCode: '',
      productName: '',
      unitPrice: 0,
      shelfLifeDate: '',
      categoryId: 0,
    });
  }

  openEditProduct(product: Product): void {

    this.showForm = true;
    this.editingProductId = this.resolveProductId(product);
    this.productForm.patchValue({
      productCode: product.productCode,
      productName: product.productName,
      unitPrice: product.unitPrice,
      shelfLifeDate: product.shelfLifeDate?.slice(0, 10) ?? '',
      categoryId: product.categoryId,
    });

  }

  closeForm(): void {
    this.showForm = false;
    this.editingProductId = null;
  }

  submitProduct(): void {

    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const raw = this.productForm.getRawValue();

    const payload: ProductPayload = {
      productCode: raw.productCode.trim(),
      productName: raw.productName.trim(),
      unitPrice: Number(raw.unitPrice),
      shelfLifeDate: raw.shelfLifeDate,
      categoryId: Number(raw.categoryId),
    };


    this.submitting = true;
    const request$ = this.isEditMode
      ? this.productsService.update(this.editingProductId as number, payload)
      : this.productsService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.isEditMode ? 'تم تعديل المنتج' : 'تم إنشاء المنتج');
        this.closeForm();
        this.loadProducts();
      },
      error: () => {
        this.openSnack(this.isEditMode ? 'فشل تعديل المنتج' : 'فشل إنشاء المنتج');
      },
    });
  }

  deleteProduct(product: Product): void {
    const id = this.resolveProductId(product);
    if (!id) {
      this.openSnack('تعذر تحديد معرف المنتج');
      return;
    }

    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      return;
    }

    this.productsService.delete(id).subscribe({
      next: () => {
        this.openSnack('تم حذف المنتج');
        this.loadProducts();
      },
      error: () => {
        this.openSnack('فشل حذف المنتج');
      },
    });
  }

  categoryNameById(categoryId: number): string {
    return this.categories.find((category) => category.categoryId === categoryId)?.categoryName ?? '-';
  }

  private resolveProductId(product: Product): number | null {
    return product.productId ?? product.id ?? null;
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (product, filter) => {
      const text = filter.trim().toLowerCase();
      return [
        product.productCode,
        product.productName,
        product.unitPrice,
        product.shelfLifeDate,
        product.categoryName ?? this.categoryNameById(product.categoryId),
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
