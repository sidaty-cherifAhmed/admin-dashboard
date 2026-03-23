export interface TourItem {
  tourItemId?: number;
  id?: number;
  loadedQt: number;
  note?: string | null;
  productId: number;
  tourId: number;
}

export interface TourItemPayload {
  loadedQt: number;
  productId: number;
  tourId: number;
}
