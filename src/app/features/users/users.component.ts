import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, finalize } from 'rxjs';

import { Role } from '../../core/models/role.model';
import { User, UserPayload } from '../../core/models/user.model';
import { RolesService } from '../../core/services/roles.service';
import { I18nService } from '../../core/services/i18n.service';
import { UsersService } from '../../core/services/users.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    TranslatePipe,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly rolesService = inject(RolesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly i18n = inject(I18nService);
  displayedColumns: string[] = ['fullName', 'email', 'phone', 'roleName', 'isActive', 'actions'];
  dataSource = new MatTableDataSource<User>([]);

  readonly filterForm = this.fb.nonNullable.group({ search: [''] });
  readonly userForm = this.fb.group({
    fullName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    phone: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(7)]),
    roleId: this.fb.control<number | null>(null, [Validators.required]),
    isActive: this.fb.nonNullable.control(true),
    password: this.fb.nonNullable.control('', [Validators.minLength(8)]),
  });

  roles: Role[] = [];
  loading = true;
  submitting = false;
  showForm = false;
  editingUserId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => {
      this.loadRoles();
      this.loadUsers();
    });
  }

  get isEditMode(): boolean {
    return this.editingUserId !== null;
  }

  loadUsers(): void {
    this.loading = true;
    this.usersService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (users) => {
          this.dataSource.data = users ?? [];
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => this.openSnack(this.i18n.t('users.loadError')),
      });
  }

  loadRoles(): void {
    this.rolesService.getAll().subscribe({
      next: (roles) => {
        this.roles = roles ?? [];
      },
      error: () => this.openSnack(this.i18n.t('users.loadRolesError')),
    });
  }

  openCreateUser(): void {
    this.editingUserId = null;
    this.showForm = true;
    this.userForm.reset({
      fullName: '',
      email: '',
      phone: '',
      roleId: null,
      isActive: true,
      password: '',
    });
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.controls.password.updateValueAndValidity();
  }

  openEditUser(user: User): void {
    this.editingUserId = user.userId;
    this.showForm = true;
    this.userForm.patchValue({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      isActive: user.isActive,
      password: '',
    });
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.setValue('');
    this.userForm.controls.password.updateValueAndValidity();
  }

  closeForm(): void {
    this.showForm = false;
    this.editingUserId = null;
  }

  submitUser(): void {
    if (this.submitting) {
      return;
    }

    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const raw = this.userForm.getRawValue();
    const payload: UserPayload = {
      fullName: raw.fullName.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim(),
      roleId: raw.roleId as number,
      isActive: raw.isActive,
    };

    if (!this.isEditMode) {
      payload.password = raw.password.trim();
    }

    this.submitting = true;
    this.cdr.detectChanges();
    const request$ = this.isEditMode
      ? this.usersService.update(this.editingUserId as number, payload)
      : this.usersService.create(payload);

    request$
      .pipe(
        finalize(() => {
          // Move the reset to the next macrotask so Angular's dev-mode
          // double-check does not see `submitting` flip in the same cycle.
          setTimeout(() => {
            this.submitting = false;
            this.cdr.detectChanges();
          }, 0);
        }),
      )
      .subscribe({
      next: () => {
        this.openSnack(this.i18n.t(this.isEditMode ? 'users.updateSuccess' : 'users.createSuccess'));
        this.closeForm();
        this.loadUsers();
      },
      error: (error: HttpErrorResponse) => {
        const backendMessage = this.extractBackendMessage(error);
        const fallback = this.i18n.t(this.isEditMode ? 'users.updateError' : 'users.createError');
        const message = backendMessage || `${fallback} (HTTP ${error.status || 0})`;
        this.openSnack(message);
      },
    });
  }

  deleteUser(id: number): void {
    if (!confirm(this.i18n.t('users.deleteConfirm'))) {
      return;
    }

    this.usersService.delete(id).subscribe({
      next: () => {
        this.openSnack(this.i18n.t('users.deleteSuccess'));
        this.loadUsers();
      },
      error: () => this.openSnack(this.i18n.t('users.deleteError')),
    });
  }

  roleNameById(roleId: number): string {
    return this.roles.find((role) => role.roleId === roleId)?.roleName ?? '-';
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (data, filter) =>
      [data.fullName, data.email, data.phone, data.roleName ?? this.roleNameById(data.roleId)]
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

  private extractBackendMessage(error: HttpErrorResponse): string {
    if (typeof error.error === 'string') {
      return error.error;
    }

    const message = (error.error?.message as string | undefined)?.trim();
    const rawFieldErrors = error.error?.fieldErrors;
    const fieldErrors = Array.isArray(rawFieldErrors)
      ? rawFieldErrors
          .map((fieldError: unknown) => {
            if (!fieldError || typeof fieldError !== 'object') {
              return '';
            }

            const record = fieldError as Record<string, unknown>;
            const field = typeof record['field'] === 'string' ? record['field'] : '';
            const errorMessage = typeof record['message'] === 'string' ? record['message'] : '';

            return [field, errorMessage].filter(Boolean).join(': ');
          })
          .filter(Boolean)
      : rawFieldErrors && typeof rawFieldErrors === 'object'
        ? Object.entries(rawFieldErrors as Record<string, unknown>)
            .map(([field, errorMessage]) => `${field}: ${String(errorMessage).trim()}`)
            .filter((entry) => entry !== ':')
        : [];

    return fieldErrors.join(', ') || message || '';
  }
}
