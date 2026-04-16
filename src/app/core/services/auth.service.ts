import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface LoginPayload {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})


export class AuthService {

  private readonly http = inject(HttpClient);

  private readonly tokenKey = 'auth_token';
  private readonly sessionKey = 'auth_session';

  private readonly authApi = `${environment.apiUrl}/auth/login`;

  login(payload: LoginPayload): Observable<void> {
        return this.http.post<unknown>(this.authApi, payload).pipe(
            tap((response) => {
              const token = this.extractToken(response);
              if (token) {
                localStorage.setItem(this.tokenKey, token);
              }
                localStorage.setItem(this.sessionKey, '1');
            }),
            map(() => void 0),
        );
  }


  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.sessionKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return localStorage.getItem(this.sessionKey) === '1';
  }

  private extractToken(response: unknown): string | null {

      if (typeof response === 'string' && response.trim()) {
        return response.trim();
      }

      if (response && typeof response === 'object') {

        const candidate = response as Record<string, unknown>;

        const tokenFields = ['token', 'accessToken', 'access_token', 'jwt', 'id_token'];

        for (const field of tokenFields) {

            const value = candidate[field];

            if (typeof value === 'string' && value.trim()) {
                  return value.trim();
            }
            
        }
        
      }
      
      return null;
  }
}
