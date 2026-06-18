"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ponytail: replaces next-themes — it rendered an inline <script> from a client
// component, which React 19 warns about and 0.4.6 can't disable. Anti-flash now
// lives in the server-rendered <head> (app/layout.tsx). light/dark only.
type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: "light", resolvedTheme: "light", setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  // Hydrate from storage after mount (the head script already applied the class).
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
