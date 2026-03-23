export interface Vehicle {
  vehicleId?: number;
  id?: number;
  model?: string;
  vehicleCode: string;
  plateNumber: string;
  capacity: number;
  isActive: boolean;
}

export interface VehiclePayload {
  vehicleCode: string;
  plateNumber: string;
  capacity: number;
  isActive: boolean;
}
