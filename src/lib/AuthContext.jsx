import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const setAuthenticatedSession = (currentUser) => {
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setIsLoadingAuth(false);
  };

  const checkAppState = async () => {
    try {
      // Base44-specific public app bootstrap has been removed.
      // Keep state shape for existing UI and migrate to backend-provided settings later.
      setIsLoadingPublicSettings(false);
      setAuthError(null);
      await checkUserAuth();
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const hasSession = typeof base44.auth?.hasSession === "function"
        ? base44.auth.hasSession()
        : true;
      if (!hasSession) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthError({
          type: "auth_required",
          message: "Authentication required"
        });
        return;
      }
      const currentUser = await base44.auth.me();
      setAuthenticatedSession(currentUser);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);

      const message = String(error?.message || "");
      const status = Number(error?.status || 0);
      const isAuthFailure = status === 401 || status === 403;
      const isServiceUnavailable =
        status >= 500 ||
        /unavailable|timeout|fetch failed|network/i.test(message);

      // Prevent repeated /me retries with stale tokens during upstream failures.
      if (isServiceUnavailable) {
        try {
          base44.auth.logout();
        } catch {
          // Ignore token-clear failures.
        }
      }

      if (isAuthFailure) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
        return;
      }

      setAuthError({
        type: isServiceUnavailable ? 'auth_unavailable' : 'unknown',
        message: isServiceUnavailable
          ? 'Authentication service is temporarily unavailable. Please try again.'
          : (message || 'Unable to verify authentication')
      });
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginPath = `/login?next=${encodeURIComponent(currentPath)}`;
    if (window.location.pathname !== "/login") {
      window.location.href = loginPath;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      setAuthenticatedSession
    }}>
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
