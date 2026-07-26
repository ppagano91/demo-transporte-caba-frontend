export interface SubteEventInfo {
  time?: number;
  delay?: number;
}

export interface SubteStationForecast {
  stop_id?: string;
  stop_name?: string;
  arrival?: SubteEventInfo;
  departure?: SubteEventInfo;
}

export interface SubteLineaForecast {
  Trip_Id?: string;
  Route_Id?: string;
  Direction_ID?: number;
  start_time?: string;
  start_date?: string;
  Estaciones: SubteStationForecast[];
}

export interface SubteEntityForecast {
  ID?: string;
  Linea?: SubteLineaForecast;
}

export interface SubteForecastResponse {
  headerTimestamp?: number;
  entities: SubteEntityForecast[];
}

export type GeoJsonGeometry =
  | {
      type: "Point";
      coordinates: [number, number] | number[];
    }
  | {
      type: "LineString";
      coordinates: Array<[number, number] | number[]>;
    }
  | {
      type: "MultiLineString";
      coordinates: Array<Array<[number, number] | number[]>>;
    }
  | {
      type: string;
      coordinates: unknown;
    };

export interface SubteGeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown> | null;
  id?: string | number;
}

export interface SubteGeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: SubteGeoJsonFeature[];
}

export interface SubteNetworkFeatureProperties {
  id?: number;
  fna?: string;
  gna?: string;
  nam?: string;
  sag?: string;
  lineCode?: string | null;
}

export interface SubteStationFeatureProperties {
  id?: number;
  fna?: string;
  gna?: string;
  nam?: string;
  ral?: string;
  cab?: string;
  sag?: string;
  lineCode?: string | null;
}
