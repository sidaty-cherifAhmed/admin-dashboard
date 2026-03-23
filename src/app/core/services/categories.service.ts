import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, CategoryPayload } from '../models/category.model';

@Injectable({ providedIn: 'root' })

export class CategoriesService {
  
  private api = `${environment.apiUrl}/categories`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Category[]> {
    return this.http.get<Category[]>(this.api);
  }

  getById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.api}/${id}`);
  }

  create(data: CategoryPayload): Observable<Category> {
    return this.http.post<Category>(this.api, data);
  }

  update(id: number, data: CategoryPayload): Observable<Category> {
    return this.http.put<Category>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
