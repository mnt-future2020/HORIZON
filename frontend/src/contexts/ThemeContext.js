import { createContext, useContext, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add("light");
    localStorage.setItem("horizon-theme", "light");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "light", setTheme: () => {}, toggleTheme: () => {}, resolvedTheme: "light" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
