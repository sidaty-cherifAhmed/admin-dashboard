import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TourStop, TourStopPayload } from '../models/tour-stop.model';

@Injectable({ providedIn: 'root' })
export class TourStopsService {
  private api = `${environment.apiUrl}/tour-stops`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<TourStop[]> {
    return this.http.get<TourStop[]>(this.api);
  }

  create(data: TourStopPayload): Observable<TourStop> {
    return this.http.post<TourStop>(this.api, data);
  }

  update(id: number, data: TourStopPayload): Observable<TourStop> {
    return this.http.put<TourStop>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
