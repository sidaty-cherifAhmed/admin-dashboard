import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DashboardSalesByPoint,
  DashboardSalesByZone,
  DashboardTopSalesPoint,
  DashboardTopSalesZone,
} from '../models/dashboard-sales.model';
import { DashboardSummary } from '../models/dashboard-summary.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  
  private readonly api = `${environment.apiUrl}/dashboard`;

  constructor(private readonly http: HttpClient) {}

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.api}/summary`);
  }

  getSalesByPoint(): Observable<DashboardSalesByPoint[]> {
    return this.http.get<DashboardSalesByPoint[]>(`${this.api}/sales/by-point`);
  }

  getSalesByZone(): Observable<DashboardSalesByZone[]> {
    return this.http.get<DashboardSalesByZone[]>(`${this.api}/sales/by-zone`);
  }

  getTopSalesZone(): Observable<DashboardTopSalesZone | null> {
    return this.http.get<DashboardTopSalesZone | null>(`${this.api}/sales/top-zone`);
  }

  getTopSalesPoint(): Observable<DashboardTopSalesPoint | null> {
    return this.http.get<DashboardTopSalesPoint | null>(`${this.api}/sales/top-point`);
  }
}
