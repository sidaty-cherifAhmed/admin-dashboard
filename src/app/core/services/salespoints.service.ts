import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SalesPoint, SalesPointPayload } from '../models/salespoint.model';

@Injectable({ providedIn: 'root' })
export class SalesPointsService {
  private api = `${environment.apiUrl}/salespoints`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<SalesPoint[]> {
    return this.http.get<SalesPoint[]>(this.api);
  }

  getById(id: number): Observable<SalesPoint> {
    return this.http.get<SalesPoint>(`${this.api}/${id}`);
  }

  create(data: SalesPointPayload): Observable<SalesPoint> {
    return this.http.post<SalesPoint>(this.api, data);
  }

  update(id: number, data: SalesPointPayload): Observable<SalesPoint> {
    return this.http.put<SalesPoint>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
