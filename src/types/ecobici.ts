export interface StationInformationItem {
  station_id?: string;
  external_id?: string;
  name?: string;
  lat?: number;
  lon?: number;
  address?: string;
  capacity?: number;
  is_charging_station?: boolean;
  rental_methods?: string[];
  groups?: string[];
  short_name?: string;
}

export interface StationInformationResponse {
  last_updated?: number;
  ttl?: number;
  data: {
    stations: StationInformationItem[];
  };
}

export interface StationStatusItem {
  station_id?: string;
  num_bikes_available?: number;
  num_bikes_disabled?: number;
  status?: string;
  num_bikes_available_types?: {
    mechanical?: number;
    ebike?: number;
  };
  num_docks_available?: number;
  num_docks_disabled?: number;
  last_reported?: number;
  is_installed?: number;
  is_renting?: number;
  is_returning?: number;
  is_charging_station?: boolean;
}

export interface StationStatusResponse {
  last_updated?: number;
  ttl?: number;
  data: {
    stations: StationStatusItem[];
  };
}

export interface EcobiciStationMerged {
  station_id: string;
  external_id?: string;
  name?: string;
  lat: number;
  lon: number;
  address?: string;
  capacity?: number;
  groups: string[];
  short_name?: string;
  rental_methods: string[];
  is_charging_station?: boolean;
  status?: string;
  num_bikes_available?: number;
  num_bikes_disabled?: number;
  mechanical?: number;
  ebike?: number;
  num_docks_available?: number;
  num_docks_disabled?: number;
  last_reported?: number;
  is_installed?: number;
  is_renting?: number;
  is_returning?: number;
  hasStatus: boolean;
}
