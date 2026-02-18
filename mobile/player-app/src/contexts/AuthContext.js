import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('horizon_token');
      if (storedToken) {
        setToken(storedToken);
        const res = await authAPI.getMe();
        setUser(res.data);
      }
    } catch (err) {
      await AsyncStorage.removeItem('horizon_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token: tok, user: usr } = res.data;
    await AsyncStorage.setItem('horizon_token', tok);
    setToken(tok);
    setUser(usr);
    return res.data;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    const { token: tok, user: usr } = res.data;
    await AsyncStorage.setItem('horizon_token', tok);
    setToken(tok);
    setUser(usr);
    return res.data;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('horizon_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
