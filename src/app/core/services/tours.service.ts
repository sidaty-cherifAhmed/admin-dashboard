import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SalesPoint } from '../models/salespoint.model';
import { Tour, TourLoadItemsPayload, TourPayload } from '../models/tour.model';

@Injectable({ providedIn: 'root' })
export class ToursService {
  private api = `${environment.apiUrl}/tours`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Tour[]> {
    return this.http.get<Tour[]>(this.api);
  }

  getById(id: number): Observable<Tour> {
    return this.http.get<Tour>(`${this.api}/${id}`);
  }

  getSalesPoints(id: number): Observable<SalesPoint[]> {
    return this.http.get<SalesPoint[]>(`${this.api}/${id}/sales-points`);
  }

  create(data: TourPayload): Observable<Tour> {
    return this.http.post<Tour>(this.api, data);
  }

  loadItems(id: number, data: TourLoadItemsPayload): Observable<unknown> {
    return this.http.post(`${this.api}/${id}/load-items`, data);
  }

  update(id: number, data: TourPayload): Observable<Tour> {
    return this.http.put<Tour>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
