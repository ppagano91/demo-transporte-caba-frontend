export type SubwayLineCode = "A" | "B" | "C" | "D" | "E" | "H";

export interface SubwayLineStyle {
  code: SubwayLineCode;
  label: string;
  color: string;
  textColor: string;
}

export const SUBWAY_LINES: readonly SubwayLineStyle[] = [
  { code: "A", label: "Linea A", color: "#00A9E0", textColor: "#ffffff" },
  { code: "B", label: "Linea B", color: "#E20613", textColor: "#ffffff" },
  { code: "C", label: "Linea C", color: "#0067A0", textColor: "#ffffff" },
  { code: "D", label: "Linea D", color: "#008C45", textColor: "#ffffff" },
  { code: "E", label: "Linea E", color: "#6B3FA0", textColor: "#ffffff" },
  { code: "H", label: "Linea H", color: "#F5C400", textColor: "#1a1a1a" },
] as const;

const LINE_BY_CODE: Record<SubwayLineCode, SubwayLineStyle> = Object.fromEntries(
  SUBWAY_LINES.map((line) => [line.code, line]),
) as Record<SubwayLineCode, SubwayLineStyle>;

const LINE_CODES = new Set<string>(SUBWAY_LINES.map((line) => line.code));

export const getSubwayLineStyle = (
  code: SubwayLineCode | null | undefined,
): SubwayLineStyle | null => {
  if (!code) {
    return null;
  }
  return LINE_BY_CODE[code] ?? null;
};

export const getSubwayLineColor = (
  code: SubwayLineCode | null | undefined,
  fallback = "#64748b",
): string => {
  return getSubwayLineStyle(code)?.color ?? fallback;
};

/**
 * Normaliza etiquetas como "Linea A", "A", "LineaA", " A" a un codigo A-H.
 */
export const parseSubwayLineCode = (
  value: string | null | undefined,
): SubwayLineCode | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  if (LINE_CODES.has(normalized)) {
    return normalized as SubwayLineCode;
  }

  const match = normalized.match(/(?:LINEA\s*)?([ABCDEH])\b/);
  if (match && LINE_CODES.has(match[1])) {
    return match[1] as SubwayLineCode;
  }

  const compact = normalized.replace(/[^A-Z]/g, "");
  if (LINE_CODES.has(compact)) {
    return compact as SubwayLineCode;
  }

  return null;
};
