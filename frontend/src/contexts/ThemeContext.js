import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("horizon-theme");
    return stored || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(sys);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem("horizon-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
