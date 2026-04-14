interface ToolbarProps {
  routeIdInput: string;
  onRouteIdInputChange: (value: string) => void;
  agencyIdInput: string;
  onAgencyIdInputChange: (value: string) => void;
  markerColor: string;
  onMarkerColorChange: (value: string) => void;
  onApplyFilter: () => void;
  onClearFilter: () => void;
  hasActiveFilter: boolean;
  canSearch: boolean;
  loading: boolean;
}

function Toolbar({
  routeIdInput,
  onRouteIdInputChange,
  agencyIdInput,
  onAgencyIdInputChange,
  markerColor,
  onMarkerColorChange,
  onApplyFilter,
  onClearFilter,
  hasActiveFilter,
  canSearch,
  loading,
}: ToolbarProps) {
  return (
    <section className="toolbar">
      <div className="toolbar-heading">
        <div>
          <p className="section-kicker">Filtros</p>
          <h2>Busqueda de vehiculos</h2>
          {/* <p className="toolbar-copy">
            Ajusta route_id, agency_id y apariencia del marcador sin mezclar
            estos controles con el estado de actualizacion.
          </p> */}
        </div>
      </div>

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
      </div>
    </section>
  );
}

export default Toolbar;
