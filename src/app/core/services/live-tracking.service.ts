import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LatestGpsLog } from '../models/latest-gps-log.model';
import { Tour } from '../models/tour.model';

@Injectable({ providedIn: 'root' })
export class LiveTrackingService {
  private readonly toursApi = `${environment.apiUrl}/tours`;
  private readonly gpsLogsApi = `${environment.apiUrl}/gpslogs`;

  constructor(private readonly http: HttpClient) {}

  getTodayTours(): Observable<Tour[]> {
    return this.http.get<Tour[]>(`${this.toursApi}/today`);
  }

  getLatestGpsLog(tourId: number): Observable<LatestGpsLog> {
    return this.http.get<LatestGpsLog>(`${this.gpsLogsApi}/last`, {
      params: {
        tourId,
      },
    });
  }
}
