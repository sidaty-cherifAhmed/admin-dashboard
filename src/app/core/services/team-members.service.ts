import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TeamMember, TeamMemberPayload } from '../models/team-member.model';

@Injectable({ providedIn: 'root' })
export class TeamMembersService {
  private api = `${environment.apiUrl}/team-members`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(this.api);
  }

  getById(id: number): Observable<TeamMember> {
    return this.http.get<TeamMember>(`${this.api}/${id}`);
  }

  create(data: TeamMemberPayload): Observable<TeamMember> {
    return this.http.post<TeamMember>(this.api, data);
  }

  update(id: number, data: TeamMemberPayload): Observable<TeamMember> {
    return this.http.put<TeamMember>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
