export interface VehiclePosition {
  id: string;
  sourceId?: string;
  vehicleId?: string;
  label?: string;
  licensePlate?: string;
  routeId?: string;
  agencyId?: string;
  agencyName?: string;
  tripId?: string;
  tripHeadsign?: string;
  tipId?: string;
  directionId?: string;
  stopId?: string;
  timestamp?: number;
  latitude: number;
  longitude: number;
  bearing?: number;
  speed?: number;
  currentStatus?: string;
  currentStopSequence?: number;
  route_short_name?: string | null;
}

export interface VehicleQueryParams {
  routeId?: string;
  agencyId?: string;
}
