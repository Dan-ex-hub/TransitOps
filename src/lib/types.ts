export type Role = "FLEET_MANAGER" | "DRIVER" | "SAFETY_OFFICER" | "FINANCIAL_ANALYST";
export type VehicleStatus = "AVAILABLE" | "ON_TRIP" | "IN_SHOP" | "RETIRED";
export type DriverStatus = "AVAILABLE" | "ON_TRIP" | "OFF_DUTY" | "SUSPENDED";
export type TripStatus = "DRAFT" | "DISPATCHED" | "COMPLETED" | "CANCELLED";
export type MaintenanceStatus = "ACTIVE" | "CLOSED";

export interface Vehicle {
  id: string;
  registrationNumber: string;
  name: string;
  model?: string;
  type: string;
  maxLoadCapacity: number;
  odometer: number;
  acquisitionCost: number;
  status: VehicleStatus;
  region: string;
}
export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiryDate: string;
  contactNumber: string;
  safetyScore: number;
  status: DriverStatus;
}
export interface Trip {
  id: string;
  source: string; sourceRegion?: string;
  destination: string; destinationRegion?: string;
  vehicleId: string; driverId: string;
  cargoWeight: number; plannedDistance: number;
  actualDistance?: number; fuelConsumed?: number; revenue?: number;
  status: TripStatus;
  dispatchedAt?: string; completedAt?: string; cancelledAt?: string;
  disrupted?: boolean; atRisk?: boolean;
}
export interface FuelLog {
  id: string; vehicleId: string; tripId?: string; liters: number; cost: number;
  date: string; impliedEfficiency?: number | null; anomalyFlag?: boolean; anomalyReason?: string;
}
export interface MaintenanceLog {
  id: string; vehicleId: string; description: string; cost: number;
  status: MaintenanceStatus; startDate: string; endDate?: string;
}
