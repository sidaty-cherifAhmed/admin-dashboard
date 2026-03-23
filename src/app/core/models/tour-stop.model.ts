export interface TourStop {
  tourStopId?: number;
  id?: number;
  tourId: number;
  salesPointId: number;
}

export interface TourStopPayload {
  tourId: number;
  salesPointId: number;
}
