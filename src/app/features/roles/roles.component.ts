import { CommonModule } from '@angular/common';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { Role, RolePayload } from '../../core/models/role.model';
import { RolesService } from '../../core/services/roles.service';
import { debounceTime } from 'rxjs';

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
  ],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  displayedColumns: string[] = ['roleName', 'description', 'actions'];
  dataSource = new MatTableDataSource<Role>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

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
    queueMicrotask(() => {
      this.loadRoles();
    });
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
        error: () => {
          this.openSnack('فشل تحميل الأدوار');
        },
      });
  }

  openCreateRole(): void {
    this.showForm = true;
    this.editingRoleId = null;
    this.roleForm.reset({
      roleName: '',
      description: '',
    });
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
        this.openSnack(this.isEditMode ? 'تم تعديل الدور' : 'تم إنشاء الدور');
        this.closeForm();
        this.loadRoles();
      },
      error: () => {
        this.openSnack(this.isEditMode ? 'فشل تعديل الدور' : 'فشل إنشاء الدور');
      },
    });
  }

  deleteRole(id: number): void {
    if (!confirm('هل أنت متأكد من حذف هذا الدور؟')) {
      return;
    }

    this.rolesService.delete(id).subscribe({
      next: () => {
        this.openSnack('تم حذف الدور');
        this.loadRoles();
      },
      error: () => {
        this.openSnack('فشل حذف الدور');
      },
    });
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (role, filter) => {
      const text = filter.trim().toLowerCase();
      return `${role.roleName} ${role.description}`.toLowerCase().includes(text);
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

