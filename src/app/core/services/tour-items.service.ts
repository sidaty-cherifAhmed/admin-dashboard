import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TourItem, TourItemPayload } from '../models/tour-item.model';

interface TourItemNoteResponse {
  tourItemId: number;
  note: string | null;
}

@Injectable({ providedIn: 'root' })
export class TourItemsService {
  private api = `${environment.apiUrl}/tour-items`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<TourItem[]> {
    return this.http.get<TourItem[]>(this.api);
  }

  getById(id: number): Observable<TourItem> {
    return this.http.get<TourItem>(`${this.api}/${id}`);
  }

  getNote(id: number): Observable<string | null> {
    return this.http.get<TourItemNoteResponse>(`${this.api}/${id}/note`).pipe(
      map((response) => {
        const note = response.note?.trim();
        return note?.length ? note : null;
      }),
    );
  }

  create(data: TourItemPayload): Observable<TourItem> {
    return this.http.post<TourItem>(this.api, data);
  }

  update(id: number, data: TourItemPayload): Observable<TourItem> {
    return this.http.put<TourItem>(`${this.api}/${id}`, data);
  }

  updateNote(id: number, note: string): Observable<unknown> {
    return this.http.put(`${this.api}/${id}/note`, { note });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
