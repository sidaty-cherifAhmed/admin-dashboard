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

import { Role, RolePayload } from '../../core/models/role.model';
import { RolesService } from '../../core/services/roles.service';
import { I18nService } from '../../core/services/i18n.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-roles',
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
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly i18n = inject(I18nService);
  displayedColumns: string[] = ['roleName', 'description', 'actions'];
  dataSource = new MatTableDataSource<Role>([]);

  readonly filterForm = this.fb.nonNullable.group({ search: [''] });
  readonly roleForm = this.fb.nonNullable.group({
    roleName: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(4)]],
  });

  loading = true;
  submitting = false;
  showForm = false;
  editingRoleId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => this.loadRoles());
  }

  get isEditMode(): boolean {
    return this.editingRoleId !== null;
  }

  loadRoles(): void {
    this.loading = true;
    this.rolesService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (roles) => {
          this.dataSource.data = roles ?? [];
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => this.openSnack(this.i18n.t('roles.loadError')),
      });
  }

  openCreateRole(): void {
    this.showForm = true;
    this.editingRoleId = null;
    this.roleForm.reset({ roleName: '', description: '' });
  }

  openEditRole(role: Role): void {
    this.showForm = true;
    this.editingRoleId = role.roleId;
    this.roleForm.patchValue({
      roleName: role.roleName,
      description: role.description ?? '',
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingRoleId = null;
  }

  submitRole(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    const payload = this.roleForm.getRawValue() as RolePayload;
    this.submitting = true;

    const request$ = this.isEditMode
      ? this.rolesService.update(this.editingRoleId as number, payload)
      : this.rolesService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.i18n.t(this.isEditMode ? 'roles.updateSuccess' : 'roles.createSuccess'));
        this.closeForm();
        this.loadRoles();
      },
      error: () => this.openSnack(this.i18n.t(this.isEditMode ? 'roles.updateError' : 'roles.createError')),
    });
  }

  deleteRole(id: number): void {
    if (!confirm(this.i18n.t('roles.deleteConfirm'))) {
      return;
    }

    this.rolesService.delete(id).subscribe({
      next: () => {
        this.openSnack(this.i18n.t('roles.deleteSuccess'));
        this.loadRoles();
      },
      error: () => this.openSnack(this.i18n.t('roles.deleteError')),
    });
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (role, filter) =>
      `${role.roleName} ${role.description}`.toLowerCase().includes(filter.trim().toLowerCase());

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
