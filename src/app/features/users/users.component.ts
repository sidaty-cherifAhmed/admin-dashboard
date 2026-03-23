import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { UsersService } from '../../core/services/users.service';
import { RolesService } from '../../core/services/roles.service';
import { Role } from '../../core/models/role.model';
import { User, UserPayload } from '../../core/models/user.model';
import { debounceTime } from 'rxjs';

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

  displayedColumns: string[] = [
    'fullName',
    'email',
    'phone',
    'roleName',
    'isActive',
    'actions',
  ];
  dataSource = new MatTableDataSource<User>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly userForm = this.fb.group({
    fullName: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    phone: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(7)]),
    roleId: this.fb.control<number | null>(null, [Validators.required]),
    isActive: this.fb.nonNullable.control(true),
    password: this.fb.nonNullable.control('', [Validators.minLength(6)]),
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
        error: () => {
          this.openSnack('فشل تحميل المستخدمين');
        },
      });
  }

  loadRoles(): void {
    this.rolesService.getAll().subscribe({
      next: (roles) => {
        this.roles = roles ?? [];
      },
      error: () => {
        this.openSnack('فشل تحميل الأدوار');
      },
    });
  }

  openCreateUser(): void {
    this.showForm = true;
    this.editingUserId = null;
    this.userForm.reset({
      fullName: '',
      email: '',
      phone: '',
      roleId: null,
      isActive: true,
      password: '',
    });
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.controls.password.updateValueAndValidity();
  }

  openEditUser(user: User): void {
    this.showForm = true;
    this.editingUserId = user.userId;
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
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const raw = this.userForm.getRawValue();
    const payload: UserPayload = {
      fullName: raw.fullName,
      email: raw.email,
      phone: raw.phone,
      roleId: raw.roleId as number,
      isActive: raw.isActive,
    };
    if (!this.isEditMode) {
      payload.password = raw.password;
    }
    this.submitting = true;

    const request$ = this.isEditMode
      ? this.usersService.update(this.editingUserId as number, payload)
      : this.usersService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.isEditMode ? 'تم تعديل المستخدم' : 'تم إنشاء المستخدم');
        this.closeForm();
        this.loadUsers();
      },
      error: (error: HttpErrorResponse) => {
        const backendMessage =
          typeof error.error === 'string'
            ? error.error
            : (error.error?.message as string | undefined) ?? '';
        const fallback = this.isEditMode ? 'فشل تعديل المستخدم' : 'فشل إنشاء المستخدم';
        const message = backendMessage || `${fallback} (HTTP ${error.status || 0})`;
        this.openSnack(message);
      },
    });
  }

  deleteUser(id: number): void {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      return;
    }

    this.usersService.delete(id).subscribe({
      next: () => {
        this.openSnack('تم حذف المستخدم');
        this.loadUsers();
      },
      error: () => {
        this.openSnack('فشل حذف المستخدم');
      },
    });
  }

  roleNameById(roleId: number): string {
    return this.roles.find((role) => role.roleId === roleId)?.roleName ?? '-';
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (data, filter) => {
      const text = filter.trim().toLowerCase();
      return [
        data.fullName,
        data.email,
        data.phone,
        data.roleName ?? this.roleNameById(data.roleId),
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


