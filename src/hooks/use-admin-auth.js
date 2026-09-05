import { useState, useEffect, useCallback } from "react";
import { adminLogin, adminLogout, adminMe } from "../lib/adminApi";

export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await adminMe();
      setAuthenticated(!!data?.authenticated);
      setUsername(data?.username || null);
    } catch {
      setAuthenticated(false);
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const data = await adminLogin({ username, password });
    setAuthenticated(true);
    setUsername(data.username);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminLogout();
    } finally {
      setAuthenticated(false);
      setUsername(null);
    }
  }, []);

  return { authenticated, username, loading, login, logout, refresh };
}
