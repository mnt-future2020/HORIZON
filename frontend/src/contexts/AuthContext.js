import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "@/lib/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("horizon_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authAPI.getMe()
        .then(res => {
          setUser(res.data);
          // Cache user for offline fallback
          try { localStorage.setItem("horizon_user", JSON.stringify(res.data)); } catch {}
        })
        .catch((err) => {
          // HIGH FIX: Only logout on 401 (invalid/expired token), not on network errors or 5xx
          if (err?.response?.status === 401) {
            localStorage.removeItem("horizon_token");
            localStorage.removeItem("horizon_refresh_token");
            localStorage.removeItem("horizon_user");
            setToken(null);
          } else if (!err.response) {
            // Network error (offline) — use cached user so app doesn't logout
            try {
              const cached = JSON.parse(localStorage.getItem("horizon_user"));
              if (cached) setUser(cached);
            } catch {}
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem("horizon_token", res.data.token);
    if (res.data.refresh_token) localStorage.setItem("horizon_refresh_token", res.data.refresh_token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (data) => {
    const res = await authAPI.register(data);
    localStorage.setItem("horizon_token", res.data.token);
    if (res.data.refresh_token) localStorage.setItem("horizon_refresh_token", res.data.refresh_token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const devLogin = useCallback(async (email) => {
    const res = await authAPI.devLogin(email);
    localStorage.setItem("horizon_token", res.data.token);
    if (res.data.refresh_token) localStorage.setItem("horizon_refresh_token", res.data.refresh_token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("horizon_token");
    localStorage.removeItem("horizon_refresh_token");
    localStorage.removeItem("horizon_user");
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((data) => setUser(prev => ({ ...prev, ...data })), []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, devLogin, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
