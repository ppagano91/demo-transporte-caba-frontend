export type ColorTheme = "light" | "dark";

/** Clave localStorage para la preferencia manual de tema (no sensible). */
export const COLOR_THEME_STORAGE_KEY = "gcba-transporte-color-theme";

export const isColorTheme = (value: unknown): value is ColorTheme => {
  return value === "light" || value === "dark";
};

export const getSystemColorTheme = (): ColorTheme => {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export const readStoredColorTheme = (): ColorTheme | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    return isColorTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const resolveInitialColorTheme = (): ColorTheme => {
  return readStoredColorTheme() ?? getSystemColorTheme();
};

export const applyColorThemeToDocument = (theme: ColorTheme): void => {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
};

export const persistColorTheme = (theme: ColorTheme): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignorar cuotas / modo privado.
  }
};
