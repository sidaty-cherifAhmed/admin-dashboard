export interface Product {
  productId?: number;
  id?: number;
  productCode: string;
  productName: string;
  unitPrice: number;
  shelfLifeDate: string;
  categoryId: number;
  categoryName?: string;
}

export interface ProductPayload {
  productCode: string;
  productName: string;
  unitPrice: number;
  shelfLifeDate: string;
  categoryId: number;
}
