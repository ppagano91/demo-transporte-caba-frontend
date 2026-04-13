interface ToolbarProps {
  routeIdInput: string;
  onRouteIdInputChange: (value: string) => void;
  agencyIdInput: string;
  onAgencyIdInputChange: (value: string) => void;
  markerColor: string;
  onMarkerColorChange: (value: string) => void;
  onApplyFilter: () => void;
  onClearFilter: () => void;
  onRefreshNow: () => void;
  refreshIntervalMs: number;
  onRefreshIntervalChange: (value: number) => void;
  lastUpdated: Date | null;
  totalVehicles: number;
  hasActiveFilter: boolean;
  appliedRouteId: string;
  appliedAgencyId: string;
  canSearch: boolean;
  loading: boolean;
  isRefreshing: boolean;
}

const formatLastUpdate = (value: Date | null): string => {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
};

function Toolbar({
  routeIdInput,
  onRouteIdInputChange,
  agencyIdInput,
  onAgencyIdInputChange,
  markerColor,
  onMarkerColorChange,
  onApplyFilter,
  onClearFilter,
  onRefreshNow,
  refreshIntervalMs,
  onRefreshIntervalChange,
  lastUpdated,
  totalVehicles,
  hasActiveFilter,
  appliedRouteId,
  appliedAgencyId,
  canSearch,
  loading,
  isRefreshing,
}: ToolbarProps) {
  return (
    <section className="toolbar">
      <div className="toolbar-controls">
        <label className="field">
          <span>route_id</span>
          <input
            value={routeIdInput}
            onChange={(event) => onRouteIdInputChange(event.target.value)}
            placeholder="Ej: 2068"
          />
        </label>
        <label className="field">
          <span>agency_id</span>
          <input
            value={agencyIdInput}
            onChange={(event) => onAgencyIdInputChange(event.target.value)}
            placeholder="Ej: 70"
          />
        </label>
        <label className="field">
          <span>Color icono</span>
          <input
            className="color-input"
            type="color"
            value={markerColor}
            onChange={(event) => onMarkerColorChange(event.target.value)}
            aria-label="Color de fondo del icono de colectivos"
          />
        </label>

        <button onClick={onApplyFilter} disabled={loading || !canSearch}>
          Aplicar filtro
        </button>
        <button
          className="secondary"
          onClick={onClearFilter}
          disabled={loading && !hasActiveFilter}
        >
          Limpiar filtros
        </button>
        <button
          className="secondary"
          onClick={onRefreshNow}
          disabled={loading || !hasActiveFilter}
        >
          Actualizar ahora
        </button>

        <label className="field">
          <span>Refresco</span>
          <select
            value={refreshIntervalMs}
            onChange={(event) =>
              onRefreshIntervalChange(Number(event.target.value))
            }
          >
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
          </select>
        </label>
      </div>

      <div className="toolbar-status">
        <span className="badge">Vehiculos visibles: {totalVehicles}</span>
        {hasActiveFilter ? (
          <span className="badge filtered">
            Filtros activos:
            {appliedRouteId ? ` route_id=${appliedRouteId}` : ""}
            {appliedAgencyId ? ` agency_id=${appliedAgencyId}` : ""}
          </span>
        ) : (
          <span className="badge">Sin filtro</span>
        )}
        <span
          className={`update-state ${isRefreshing ? "refreshing" : "idle"}`}
        >
          {isRefreshing ? "Actualizando..." : "Estable"}
        </span>
        <span className="last-updated">
          Ultima actualizacion: {formatLastUpdate(lastUpdated)}
        </span>
      </div>
    </section>
  );
}

export default Toolbar;
