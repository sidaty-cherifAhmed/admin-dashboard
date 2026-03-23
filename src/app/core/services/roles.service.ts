import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role, RolePayload } from '../models/role.model';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private api = `${environment.apiUrl}/roles`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Role[]> {
    return this.http.get<Role[]>(this.api);
  }

  getById(id: number): Observable<Role> {
    return this.http.get<Role>(`${this.api}/${id}`);
  }

  create(data: RolePayload): Observable<Role> {
    return this.http.post<Role>(this.api, data);
  }

  update(id: number, data: RolePayload): Observable<Role> {
    return this.http.put<Role>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}

