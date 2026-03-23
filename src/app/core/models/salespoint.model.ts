export interface SalesPoint {
  salesPointId?: number;
  id?: number;
  name: string;
  adresse: string;
  zone: string;
  gpsLatitude: number;
  gpsLongitude: number;
  isActive: boolean;
}

export interface SalesPointPayload {
  name: string;
  adresse: string;
  zone: string;
  gpsLatitude: number;
  gpsLongitude: number;
  isActive: boolean;
}
