import React, { createContext, useState, useEffect } from 'react';
import { loginUser, registerUser, logoutUser, refreshSession } from '../services/auth';
import { hasSessionIndicator } from '../services/api';

export const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize and check for existing session
  useEffect(() => {
    async function initSession() {
      if (hasSessionIndicator()) {
        try {
          const currentUser = await refreshSession();
          if (currentUser) {
            setUser(currentUser);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    }

    initSession();

    // Subscribe to auto-logout event emitted by api.js when refresh fails
    const handleAutoLogout = () => {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    };

    window.addEventListener('auth-logout', handleAutoLogout);
    return () => {
      window.removeEventListener('auth-logout', handleAutoLogout);
    };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const currentUser = await loginUser(email, password);
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err?.detail || 'Login failed. Please check your credentials.');
      setUser(null);
      setIsAuthenticated(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    setError(null);
    try {
      await registerUser(userData);
      try {
        // Automatically log in after registration when possible.
        await login(userData.email, userData.password);
        return { registered: true, autoLoggedIn: true };
      } catch {
        // Registration succeeded; keep the user signed out and let the UI guide them to login.
        setUser(null);
        setIsAuthenticated(false);
        setError(null);
        return { registered: true, autoLoggedIn: false };
      }
    } catch (err) {
      setError(err?.detail || 'Registration failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      setError(null);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
