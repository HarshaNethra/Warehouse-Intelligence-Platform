import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface UserSession {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'OPERATOR' | string;
  facility_id?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserSession;
}

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AUTH_TOKEN_KEY = 'wms_auth_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (e) {
      console.error(e);
    }
    setToken(null);
    setUser(null);
    setIsLoading(false);
  }, []);

  // Validate existing token on mount
  useEffect(() => {
    let isMounted = true;

    if (!token) {
      setIsLoading(false);
      return;
    }

    // Handle demo synthetic token
    if (token.startsWith('demo-jwt-token')) {
      let role = 'SUPERVISOR';
      let email = 'supervisor@wms-intel.io';
      let full_name = 'Chief Supervisor';
      let id = 'user-sup-01';

      if (token.includes('operator')) {
        role = 'OPERATOR';
        email = 'operator@wms-intel.io';
        full_name = 'Bay Operator';
        id = 'user-op-01';
      } else if (token.includes('admin')) {
        role = 'ADMIN';
        email = 'admin@wms-intel.io';
        full_name = 'System Administrator';
        id = 'user-admin-01';
      }

      setUser({
        id,
        email,
        full_name,
        role,
        facility_id: 'FAC-001'
      });
      setIsLoading(false);
      return;
    }

    apiClient.get<UserSession>('/auth/me')
      .then((userData) => {
        if (!isMounted) return;
        setUser(userData);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Session token validation failed:', err);
        logout();
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, logout]);

  // Listen for 401 unauthorized events from apiClient
  useEffect(() => {
    const handleUnauthorized = () => {
      if (token && token.startsWith('demo-jwt-token')) return;
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout, token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const cleanEmail = email.trim();

    try {
      const res = await apiClient.post<AuthResponse>('/auth/login', { email: cleanEmail, password });
      const newJwt = res.access_token;
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, newJwt);
      } catch (e) {
        console.error(e);
      }
      setToken(newJwt);
      setUser(res.user);
    } catch (err: any) {
      // Demo Fallback: If login fails or backend auth endpoint is unreachable, support prototype testing for demo accounts
      if (cleanEmail.toLowerCase().includes('@wms-intel.io')) {
        console.warn('[AuthContext] Live backend login unresolvable. Activating demo session fallback.');
        let role = 'SUPERVISOR';
        let full_name = 'Chief Supervisor';
        let id = 'user-sup-01';

        if (cleanEmail.toLowerCase().includes('operator')) {
          role = 'OPERATOR';
          full_name = 'Bay Operator';
          id = 'user-op-01';
        } else if (cleanEmail.toLowerCase().includes('admin')) {
          role = 'ADMIN';
          full_name = 'System Administrator';
          id = 'user-admin-01';
        }

        const demoUser: UserSession = {
          id,
          email: cleanEmail,
          full_name,
          role,
          facility_id: 'FAC-001'
        };
        const demoToken = `demo-jwt-token-${role.toLowerCase()}`;
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, demoToken);
        } catch (e) {
          console.error(e);
        }
        setToken(demoToken);
        setUser(demoUser);
        return;
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
