import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, debounceTime } from 'rxjs';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { TeamMember, TeamMemberPayload } from '../../core/models/team-member.model';
import { Team } from '../../core/models/team.model';
import { User } from '../../core/models/user.model';
import { TeamMembersService } from '../../core/services/team-members.service';
import { TeamsService } from '../../core/services/teams.service';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-team-members',
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
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './team-members.component.html',
  styleUrl: './team-members.component.scss',
})
export class TeamMembersComponent implements OnInit {
  private readonly teamMembersService = inject(TeamMembersService);
  private readonly usersService = inject(UsersService);
  private readonly teamsService = inject(TeamsService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  displayedColumns: string[] = ['user', 'team', 'actions'];
  dataSource = new MatTableDataSource<TeamMember>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly teamMemberForm = this.fb.group({
    userId: this.fb.control<number | null>(null, [Validators.required]),
    teamId: this.fb.control<number | null>(null, [Validators.required]),
  });

  users: User[] = [];
  teams: Team[] = [];
  loading = true;
  submitting = false;
  showForm = false;
  editingTeamMemberId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => {
      this.loadUsers();
      this.loadTeams();
      this.loadTeamMembers();
    });
  }

  get isEditMode(): boolean {
    return this.editingTeamMemberId !== null;
  }

  loadTeamMembers(): void {
    this.loading = true;
    this.teamMembersService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (teamMembers) => {
          this.dataSource.data = teamMembers ?? [];
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => {
          this.openSnack('فشل تحميل أعضاء الفرق');
        },
      });
  }

  loadUsers(): void {
    this.usersService.getAll().subscribe({
      next: (users) => {
        this.users = users ?? [];
      },
      error: () => {
        this.openSnack('فشل تحميل المستخدمين');
      },
    });
  }

  loadTeams(): void {
    this.teamsService.getAll().subscribe({
      next: (teams) => {
        this.teams = teams ?? [];
      },
      error: () => {
        this.openSnack('فشل تحميل الفرق');
      },
    });
  }

  openCreateTeamMember(): void {
    this.showForm = true;
    this.editingTeamMemberId = null;
    this.teamMemberForm.reset({
      userId: null,
      teamId: null,
    });
  }

  openEditTeamMember(teamMember: TeamMember): void {
    this.showForm = true;
    this.editingTeamMemberId = teamMember.teamMemberId;
    this.teamMemberForm.patchValue({
      userId: teamMember.userId,
      teamId: teamMember.teamId,
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingTeamMemberId = null;
  }

  submitTeamMember(): void {
    if (this.teamMemberForm.invalid) {
      this.teamMemberForm.markAllAsTouched();
      return;
    }

    const raw = this.teamMemberForm.getRawValue();
    const payload: TeamMemberPayload = {
      userId: raw.userId as number,
      teamId: raw.teamId as number,
    };
    this.submitting = true;

    const request$ = this.isEditMode
      ? this.teamMembersService.update(this.editingTeamMemberId as number, payload)
      : this.teamMembersService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.isEditMode ? 'تم تعديل عضو الفريق' : 'تمت إضافة عضو للفريق');
        this.closeForm();
        this.loadTeamMembers();
      },
      error: () => {
        this.openSnack(this.isEditMode ? 'فشل تعديل عضو الفريق' : 'فشل إضافة عضو للفريق');
      },
    });
  }

  deleteTeamMember(id: number): void {
    if (!confirm('هل أنت متأكد من حذف هذا الربط؟')) {
      return;
    }

    this.teamMembersService.delete(id).subscribe({
      next: () => {
        this.openSnack('تم حذف الربط');
        this.loadTeamMembers();
      },
      error: () => {
        this.openSnack('فشل حذف الربط');
      },
    });
  }

  userLabel(teamMember: TeamMember): string {
    return (
      teamMember.fullName ??
      this.users.find((user) => user.userId === teamMember.userId)?.fullName ??
      `#${teamMember.userId}`
    );
  }

  userSubLabel(teamMember: TeamMember): string {
    return (
      teamMember.email ??
      this.users.find((user) => user.userId === teamMember.userId)?.email ??
      ''
    );
  }

  teamLabel(teamMember: TeamMember): string {
    return (
      teamMember.teamName ??
      this.teams.find((team) => team.teamId === teamMember.teamId)?.teamName ??
      `#${teamMember.teamId}`
    );
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (teamMember, filter) => {
      const text = filter.trim().toLowerCase();
      return [
        this.userLabel(teamMember),
        this.userSubLabel(teamMember),
        this.teamLabel(teamMember),
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

  private openSnack(message: string): void {
    this.snackBar.open(message, 'إغلاق', {
      duration: 2600,
      horizontalPosition: 'start',
      verticalPosition: 'top',
    });
  }
}
