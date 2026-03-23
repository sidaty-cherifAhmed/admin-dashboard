import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Vehicle, VehiclePayload } from '../models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehiclesService {
  private api = `${environment.apiUrl}/vehicles`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(this.api);
  }

  getById(id: number): Observable<Vehicle> {
    return this.http.get<Vehicle>(`${this.api}/${id}`);
  }

  create(data: VehiclePayload): Observable<Vehicle> {
    return this.http.post<Vehicle>(this.api, data);
  }

  update(id: number, data: VehiclePayload): Observable<Vehicle> {
    return this.http.put<Vehicle>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
