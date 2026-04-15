export interface Vehicle {
  vehicleId?: number;
  id?: number;
  vehicleCode: string;
  plateNumber?: string | null;
  capacity?: number | null;
  mark?: string | null;
  type?: string | null;
  year?: number | null;
  mileage?: number | null;
  isActive: boolean;
}

export interface VehiclePayload {
  vehicleCode: string;
  plateNumber?: string;
  capacity?: number;
  mark?: string;
  type?: string;
  year?: number;
  mileage?: number;
  isActive?: boolean;
}
