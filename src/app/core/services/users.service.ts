import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserPayload } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private api = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.api);
  }

  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.api}/${id}`);
  }

  create(payload: UserPayload): Observable<User> {
    return this.http.post<User>(this.api, payload);
  }

  update(id: number, payload: UserPayload): Observable<User> {
    return this.http.put<User>(`${this.api}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
