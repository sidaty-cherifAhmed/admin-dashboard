export interface Tour {
  tourId?: number;
  id?: number;
  tourDate: string;
  vehicleId: number;
  teamId: number;
  status?: string | null;
}

export interface TourPayload {
  tourDate: string;
  vehicleId: number;
  teamId: number;
  status: string;
}
