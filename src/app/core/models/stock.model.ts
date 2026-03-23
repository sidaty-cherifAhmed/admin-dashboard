export interface Stock {
  stockId?: number;
  id?: number;
  quantity: number;
  productId: number;
  productName?: string;
  product?: {
    productId?: number;
    id?: number;
    productName?: string;
  };
}

export interface StockPayload {
  quantity: number;
  productId: number;
}
