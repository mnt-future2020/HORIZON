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
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("horizon_token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem("horizon_token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (data) => {
    const res = await authAPI.register(data);
    localStorage.setItem("horizon_token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("horizon_token");
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((data) => setUser(prev => ({ ...prev, ...data })), []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
