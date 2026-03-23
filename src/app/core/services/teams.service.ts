import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Team, TeamPayload } from '../models/team.model';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private api = `${environment.apiUrl}/teams`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Team[]> {
    return this.http.get<Team[]>(this.api);
  }

  getById(id: number): Observable<Team> {
    return this.http.get<Team>(`${this.api}/${id}`);
  }

  create(data: TeamPayload): Observable<Team> {
    return this.http.post<Team>(this.api, data);
  }

  update(id: number, data: TeamPayload): Observable<Team> {
    return this.http.put<Team>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
