import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Stock, StockPayload } from '../models/stock.model';

@Injectable({ providedIn: 'root' })
export class StocksService {
  private api = `${environment.apiUrl}/stocks`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Stock[]> {
    return this.http.get<Stock[]>(this.api);
  }

  getById(id: number): Observable<Stock> {
    return this.http.get<Stock>(`${this.api}/${id}`);
  }

  create(data: StockPayload): Observable<Stock> {
    return this.http.post<Stock>(this.api, data);
  }

  update(id: number, data: StockPayload): Observable<Stock> {
    return this.http.put<Stock>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
