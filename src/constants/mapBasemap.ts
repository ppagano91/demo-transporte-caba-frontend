/**
 * Estilo del mapa base (MapLibre).
 * Para cambiar el proveedor en el futuro, modificar únicamente este archivo.
 * No agregar API keys ni proveedores nuevos hasta la tarea dedicada.
 */
export const MAP_BASEMAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
    },
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
};
