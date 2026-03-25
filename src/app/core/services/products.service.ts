import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, ProductPayload } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private api = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.api);
  }

  getById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.api}/${id}`);
  }

  getProductName(id: number): Observable<string> {
    return this.http.get(`${this.api}/${id}/product-name`, {
      responseType: 'text',
    });
  }

  create(data: ProductPayload): Observable<Product> {
    return this.http.post<Product>(this.api, data);
  }

  update(id: number, data: ProductPayload): Observable<Product> {
    return this.http.put<Product>(`${this.api}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
