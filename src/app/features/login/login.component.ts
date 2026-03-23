import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submitting = false;

  submit(): void {
    
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.finishSubmitting();
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const target = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/';
        void this.router.navigateByUrl(target);
      },
      error: (error: HttpErrorResponse) => {
            this.finishSubmitting();
            const backendMessage =
              typeof error.error === 'string'
                ? error.error
                : (error.error?.message as string | undefined) ?? '';
                
            const message = backendMessage || 'فشل تسجيل الدخول';

            this.snackBar.open(message, 'Close', {
              duration: 2800,
              horizontalPosition: 'start',
              verticalPosition: 'top',
            });

      },
    });
  }

  private finishSubmitting(): void {
    setTimeout(() => {
      this.submitting = false;
    }, 0);
  }
}
