import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Observable, debounceTime, finalize, forkJoin, of } from 'rxjs';

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

import { TeamMember, TeamMemberPayload } from '../../core/models/team-member.model';
import { Team } from '../../core/models/team.model';
import { User } from '../../core/models/user.model';
import { I18nService } from '../../core/services/i18n.service';
import { TeamMembersService } from '../../core/services/team-members.service';
import { TeamsService } from '../../core/services/teams.service';
import { UsersService } from '../../core/services/users.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

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
    TranslatePipe,
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

  readonly i18n = inject(I18nService);
  displayedColumns: string[] = ['user', 'team', 'actions'];
  dataSource = new MatTableDataSource<TeamMember>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly teamMemberForm = this.fb.group({
    userId: this.fb.control<number | null>(null),
    userIds: this.fb.nonNullable.control<number[]>([], [this.requireSelection]),
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
        error: () => this.openSnack(this.i18n.t('teamMembers.loadError')),
      });
  }

  loadUsers(): void {
    this.usersService.getAll().subscribe({
      next: (users) => {
        this.users = users ?? [];
      },
      error: () => this.openSnack(this.i18n.t('teamMembers.loadUsersError')),
    });
  }

  loadTeams(): void {
    this.teamsService.getAll().subscribe({
      next: (teams) => {
        this.teams = teams ?? [];
      },
      error: () => this.openSnack(this.i18n.t('teamMembers.loadTeamsError')),
    });
  }

  openCreateTeamMember(): void {
    this.showForm = true;
    this.editingTeamMemberId = null;
    this.teamMemberForm.reset({
      userId: null,
      userIds: [],
      teamId: null,
    });
    this.syncUserValidationState();
  }

  openEditTeamMember(teamMember: TeamMember): void {
    this.showForm = true;
    this.editingTeamMemberId = teamMember.teamMemberId;
    this.teamMemberForm.patchValue({
      userId: teamMember.userId,
      userIds: [teamMember.userId],
      teamId: teamMember.teamId,
    });
    this.syncUserValidationState();
  }

  closeForm(): void {
    this.showForm = false;
    this.editingTeamMemberId = null;
  }

  submitTeamMember(): void {
    this.syncUserValidationState();
    if (this.teamMemberForm.invalid) {
      this.teamMemberForm.markAllAsTouched();
      return;
    }

    const raw = this.teamMemberForm.getRawValue();
    const duplicateSelection = this.findDuplicateSelection(raw.teamId as number, this.isEditMode ? [raw.userId as number] : raw.userIds);
    if (duplicateSelection) {
      this.openSnack(this.i18n.t('teamMembers.duplicateMember'));
      return;
    }

    this.submitting = true;
    const request$: Observable<unknown> = this.isEditMode
      ? this.teamMembersService.update(this.editingTeamMemberId as number, {
          userId: raw.userId as number,
          teamId: raw.teamId as number,
        })
      : this.createTeamMembers(raw.teamId as number, raw.userIds);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.i18n.t(this.isEditMode ? 'teamMembers.updateSuccess' : 'teamMembers.createSuccess'));
        this.closeForm();
        this.loadTeamMembers();
      },
      error: () => this.openSnack(this.i18n.t(this.isEditMode ? 'teamMembers.updateError' : 'teamMembers.createError')),
    });
  }

  deleteTeamMember(id: number): void {
    if (!confirm(this.i18n.t('teamMembers.deleteConfirm'))) {
      return;
    }

    this.teamMembersService.delete(id).subscribe({
      next: () => {
        this.openSnack(this.i18n.t('teamMembers.deleteSuccess'));
        this.loadTeamMembers();
      },
      error: () => this.openSnack(this.i18n.t('teamMembers.deleteError')),
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

  private createTeamMembers(teamId: number, userIds: number[]): Observable<unknown> {
    const uniqueUserIds = [...new Set(userIds.map((userId) => Number(userId)).filter((userId) => userId > 0))];
    if (uniqueUserIds.length === 0) {
      return of([]);
    }

    return forkJoin(
      uniqueUserIds.map((userId) =>
        this.teamMembersService.create({
          userId,
          teamId,
        } satisfies TeamMemberPayload),
      ),
    );
  }

  private findDuplicateSelection(teamId: number, userIds: number[]): number | null {
    const selectedTeamId = Number(teamId);
    const selectedUserIds = [...new Set(userIds.map((userId) => Number(userId)).filter((userId) => userId > 0))];
    const currentId = this.editingTeamMemberId;

    return (
      selectedUserIds.find((userId) =>
        this.dataSource.data.some(
          (teamMember) =>
            teamMember.teamId === selectedTeamId &&
            teamMember.userId === userId &&
            (!currentId || teamMember.teamMemberId !== currentId),
        ),
      ) ?? null
    );
  }

  private syncUserValidationState(): void {
    const userIdControl = this.teamMemberForm.controls.userId;
    const userIdsControl = this.teamMemberForm.controls.userIds;

    if (this.isEditMode) {
      userIdControl.setValidators([Validators.required]);
      userIdsControl.clearValidators();
    } else {
      userIdControl.clearValidators();
      userIdsControl.setValidators([this.requireSelection]);
    }

    userIdControl.updateValueAndValidity({ emitEvent: false });
    userIdsControl.updateValueAndValidity({ emitEvent: false });
  }

  private requireSelection(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    return Array.isArray(value) && value.length > 0 ? null : { required: true };
  }

  private openSnack(message: string): void {
    this.snackBar.open(message, this.i18n.t('common.closeAction'), {
      duration: 2600,
      horizontalPosition: 'start',
      verticalPosition: 'top',
    });
  }
}
