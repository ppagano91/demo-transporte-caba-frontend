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
