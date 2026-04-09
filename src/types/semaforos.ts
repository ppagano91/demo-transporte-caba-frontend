export interface SemaforoItem {
  provider?: string;
  type?: string;
  code?: string;
  name?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
}

export interface SemaforosResponse {
  list: SemaforoItem[];
}

export interface SemaforoMapItem {
  provider?: string;
  type?: string;
  code?: string;
  name?: string;
  status?: string;
  latitude: number;
  longitude: number;
}
