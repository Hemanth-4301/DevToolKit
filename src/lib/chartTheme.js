// Reads concrete color strings from the currently active CSS theme so
// Chart.js (which needs real color values, not CSS var references) stays
// in sync with whichever of the app's 3 themes (light/dark/dev-mode) is
// active, instead of hardcoding a palette that would clash in the others.
//
// Colors are returned as raw "H S% L%" triplets (not wrapped in hsl(...))
// so callers can compose solid or translucent variants via alpha().
export function readThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  const triplet = (name, fallback) => {
    const value = styles.getPropertyValue(name).trim();
    return value || fallback;
  };

  return {
    foreground: triplet("--foreground", "240 10% 4%"),
    mutedForeground: triplet("--muted-foreground", "240 4% 46%"),
    border: triplet("--border", "240 6% 90%"),
    accent: triplet("--accent", "240 5% 96%"),
    ring: triplet("--ring", "217 91% 60%"),
    devCyan: triplet("--dev-cyan", "142 100% 45%"),
  };
}

// Solid hsl(...) string from a raw triplet.
export function solid(triplet) {
  return `hsl(${triplet})`;
}

// Translucent hsl(... / alpha) string from a raw triplet.
export function alpha(triplet, amount) {
  return `hsl(${triplet} / ${amount})`;
}
