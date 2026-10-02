import { useState, useEffect } from "react";
import { safeSetItem } from "../lib/utils";

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("devtoolkit_theme");
    return saved || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    safeSetItem("devtoolkit_theme", theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");

  return { theme, toggle };
}
