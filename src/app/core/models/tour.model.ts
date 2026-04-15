export type TourStatus = "didn't start" | 'start' | 'end';

export interface Tour {
  tourId?: number;
  id?: number;
  tourDate: string;
  vehicleId: number;
  teamId: number;
  status?: TourStatus | string | null;
}

export interface TourPayload {
  tourDate: string;
  vehicleId: number;
  teamId: number;
  status: TourStatus;
}

export interface TourLoadItemPayload {
  productId: number;
  quantity: number;
}

export interface TourLoadItemsPayload {
  items: TourLoadItemPayload[];
}
