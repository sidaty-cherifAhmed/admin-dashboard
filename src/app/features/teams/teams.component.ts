import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, finalize, forkJoin, of, switchMap } from 'rxjs';

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

import { TeamMember } from '../../core/models/team-member.model';
import { Team, TeamPayload } from '../../core/models/team.model';
import { TeamMembersService } from '../../core/services/team-members.service';
import { TeamsService } from '../../core/services/teams.service';

@Component({
  selector: 'app-teams',
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
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss',
})
export class TeamsComponent implements OnInit {
  private readonly teamsService = inject(TeamsService);
  private readonly teamMembersService = inject(TeamMembersService);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  displayedColumns: string[] = ['teamName', 'actions'];
  dataSource = new MatTableDataSource<Team>([]);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly teamForm = this.fb.nonNullable.group({
    teamName: ['', [Validators.required, Validators.minLength(2)]],
  });

  loading = true;
  submitting = false;
  showForm = false;
  editingTeamId: number | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.initFiltering();
    queueMicrotask(() => {
      this.loadTeams();
    });
  }

  get isEditMode(): boolean {
    return this.editingTeamId !== null;
  }

  loadTeams(): void {
    this.loading = true;
    this.teamsService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (teams) => {
          this.dataSource.data = teams ?? [];
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
        },
        error: () => {
          this.openSnack('فشل تحميل الفرق');
        },
      });
  }

  openCreateTeam(): void {
    this.showForm = true;
    this.editingTeamId = null;
    this.teamForm.reset({
      teamName: '',
    });
  }

  openEditTeam(team: Team): void {
    this.showForm = true;
    this.editingTeamId = team.teamId;
    this.teamForm.patchValue({
      teamName: team.teamName,
    });
  }

  closeForm(): void {
    this.showForm = false;
    this.editingTeamId = null;
  }

  submitTeam(): void {
    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    const payload = this.teamForm.getRawValue() as TeamPayload;
    this.submitting = true;

    const request$ = this.isEditMode
      ? this.teamsService.update(this.editingTeamId as number, payload)
      : this.teamsService.create(payload);

    request$.pipe(finalize(() => (this.submitting = false))).subscribe({
      next: () => {
        this.openSnack(this.isEditMode ? 'تم تعديل الفريق' : 'تم إنشاء الفريق');
        this.closeForm();
        this.loadTeams();
      },
      error: () => {
        this.openSnack(this.isEditMode ? 'فشل تعديل الفريق' : 'فشل إنشاء الفريق');
      },
    });
  }

  deleteTeam(id: number): void {
    if (!confirm('هل أنت متأكد من حذف هذا الفريق؟')) {
      return;
    }

    this.teamMembersService
      .getAll()
      .pipe(
        switchMap((teamMembers) => this.deleteTeamMembersBeforeTeamDelete(id, teamMembers ?? [])),
        switchMap(() => this.teamsService.delete(id)),
      )
      .subscribe({
        next: () => {
          this.openSnack('تم حذف الفريق');
          this.loadTeams();
        },
        error: () => {
          this.openSnack('فشل حذف الفريق');
        },
      });
  }

  private deleteTeamMembersBeforeTeamDelete(id: number, teamMembers: TeamMember[]) {
    const linkedMembers = teamMembers.filter((teamMember) => teamMember.teamId === id);

    if (linkedMembers.length === 0) {
      return of(void 0);
    }

    return forkJoin(
      linkedMembers.map((teamMember) => this.teamMembersService.delete(teamMember.teamMemberId)),
    );
  }

  private initFiltering(): void {
    this.dataSource.filterPredicate = (team, filter) => {
      const text = filter.trim().toLowerCase();
      return team.teamName.toLowerCase().includes(text);
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
