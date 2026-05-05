// lib/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { apiClient, setTokens, clearTokens } from '../api-client';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
}

export interface UseAuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check current user on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await apiClient.auth.getCurrentUser();
        if (currentUser?.id) {
          setUser(currentUser);
        }
      } catch (err) {
        // Not authenticated
        console.debug('User not authenticated');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.auth.login(email, password) as any;
      if (result?.access && result?.refresh) {
        setTokens(result.access, result.refresh);
      }
      if (result?.user) {
        setUser(result.user);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiClient.auth.logout();
      clearTokens();
      setUser(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
