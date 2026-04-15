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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, finalize } from 'rxjs';

import { Category, CategoryPayload } from '../../core/models/category.model';
import { CategoriesService } from '../../core/services/categories.service';
import { I18nService } from '../../core/services/i18n.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-categories',
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
    TranslatePipe,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly i18n = inject(I18nService);
  displayedColumns: string[] = ['categoryName', 'actions'];
  dataSource = new MatTableDataSource<Category>([]);

  readonly filterForm = this.fb.nonNullable.group({ search: [''] });
  readonly categoryForm = this.fb.nonNullable.group({
    categoryName: ['', [Validators.required, Validators.minLength(2)]],
  });

  loading = true;
  submitting = false;
  showForm = false;
  editingCategoryId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => this.loadCategories());
  }

  get isEditMode(): boolean {
    return this.editingCategoryId !== null;
  }

  loadCategories(): void {
    this.loading = true;
    this.categoriesService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (categories) => {
          this.dataSource.data = categories ?? [];
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => this.openSnack(this.i18n.t('categories.loadError')),
      });
  }

  openCreateCategory(): void {
    this.showForm = true;
    this.editingCategoryId = null;
    this.categoryForm.reset({ categoryName: '' });
  }

  openEditCategory(category: Category): void {
    this.showForm = true;
    this.editingCategoryId = category.categoryId;
    this.categoryForm.patchValue({ categoryName: category.categoryName });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingCategoryId = null;
  }

  submitCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const payload = this.categoryForm.getRawValue() as CategoryPayload;
    this.submitting = true;

    const request$ = this.isEditMode
      ? this.categoriesService.update(this.editingCategoryId as number, payload)
      : this.categoriesService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.i18n.t(this.isEditMode ? 'categories.updateSuccess' : 'categories.createSuccess'));
        this.closeForm();
        this.loadCategories();
      },
      error: () => {
        this.openSnack(this.i18n.t(this.isEditMode ? 'categories.updateError' : 'categories.createError'));
      },
    });
  }

  deleteCategory(id: number): void {
    if (!confirm(this.i18n.t('categories.deleteConfirm'))) {
      return;
    }

    this.categoriesService.delete(id).subscribe({
      next: () => {
        this.openSnack(this.i18n.t('categories.deleteSuccess'));
        this.loadCategories();
      },
      error: () => this.openSnack(this.i18n.t('categories.deleteError')),
    });
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (category, filter) =>
      category.categoryName.toLowerCase().includes(filter.trim().toLowerCase());

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
