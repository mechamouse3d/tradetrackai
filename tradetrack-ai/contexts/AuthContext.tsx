import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '../types';
import { useAuth0 } from "@auth0/auth0-react";
import { dataService } from '../services/dataService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: () => Promise<void>; // Simplified signature as Auth0 handles the form
  register: () => Promise<void>; // Simplified signature
  logout: () => void;
  clearError: () => void;
  setReloadTrigger?: (trigger: number) => void; // Function to trigger data reload in App
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global ref to store the setReloadTrigger callback from App
let reloadTriggerCallback: ((value: number) => void) | null = null;

// Track if dataService has been initialized
let dataServiceInitialized = false;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    user: auth0User, 
    isAuthenticated, 
    isLoading: isAuth0Loading, 
    loginWithRedirect, 
    logout: auth0Logout,
    error: auth0Error,
    getIdTokenClaims,
    getAccessTokenSilently,
  } = useAuth0();

  const [appUser, setAppUser] = useState<User | null>(null);

  // Helper function to get fresh token
  const refreshAuthToken = async () => {
    if (!isAuthenticated) return null;
    try {
      const claims = await getIdTokenClaims();
      return claims?.__raw;
    } catch (error) {
      console.error('Failed to refresh auth token:', error);
      return null;
    }
  };

  // Map Auth0 user to App User type and sync with backend
  useEffect(() => {
    if (isAuthenticated && auth0User) {
      (async () => {
        try {
          console.log('[AUTH] User authenticated:', auth0User.sub);
          
          // Get Auth0 ID token
          const idToken = await refreshAuthToken();
          console.log('[AUTH] ID token obtained:', idToken ? 'YES' : 'NO');

          if (idToken) {
            // Initialize data service for authenticated mode
            console.log('[AUTH] Initializing dataService in authenticated mode');
            dataService.initialize({
              isAuthenticated: true,
              auth0Token: idToken,
            });
            dataServiceInitialized = true;

            // IMPORTANT: Sync user to backend FIRST before loading data
            // This ensures the user exists in the database
            console.log('[AUTH] Syncing user to backend...');
            await dataService.syncUser({
              email: auth0User.email || '',
              name: auth0User.name || auth0User.email || 'User',
              photoURL: auth0User.picture,
            });
            console.log('[AUTH] ✅ User synced successfully');

            // NOW migrate demo data to authenticated user
            console.log('[AUTH] Migrating demo data to authenticated user...');
            const demoTransactions = JSON.parse(localStorage.getItem('transactions_demo') || '[]');
            const demoPrices = JSON.parse(localStorage.getItem('prices_demo') || '{}');
            
            if (demoTransactions.length > 0 || Object.keys(demoPrices).length > 0) {
              console.log(`[AUTH] Found ${demoTransactions.length} demo transactions to migrate`);
              // Sync demo data to API under authenticated user
              if (demoTransactions.length > 0) {
                try {
                  await dataService.saveTransactions(auth0User.sub || 'unknown', demoTransactions);
                  console.log('[AUTH] ✅ Demo transactions migrated to API');
                } catch (e) {
                  console.error('[AUTH] Failed to migrate transactions:', e);
                }
              }
              if (Object.keys(demoPrices).length > 0) {
                try {
                  await dataService.savePrices(auth0User.sub || 'unknown', demoPrices);
                  console.log('[AUTH] ✅ Demo prices migrated to API');
                } catch (e) {
                  console.error('[AUTH] Failed to migrate prices:', e);
                }
              }
            }

            // TRIGGER RELOAD: Force App.tsx to reload transactions after user auth is complete
            console.log('[AUTH] Triggering data reload in App component...');
            if (reloadTriggerCallback) {
              reloadTriggerCallback(prev => prev + 1);
              console.log('[AUTH] ✅ Data reload triggered');
            }
          } else {
            console.error('[AUTH] ❌ Failed to get ID token');
          }

          setAppUser({
            id: auth0User.sub || 'unknown',
            name: auth0User.name || auth0User.email || 'User',
            email: auth0User.email || '',
            photoURL: auth0User.picture
          });
        } catch (error) {
          console.error('[AUTH] ❌ Failed to sync user to backend:', error);
          // Still set user even if sync fails (will use localStorage as fallback)
          setAppUser({
            id: auth0User.sub || 'unknown',
            name: auth0User.name || auth0User.email || 'User',
            email: auth0User.email || '',
            photoURL: auth0User.picture
          });
        }
      })();
    } else {
      // Not authenticated: use demo mode (localStorage)
      console.log('[AUTH] User not authenticated, using demo mode');
      dataService.initialize({
        isAuthenticated: false,
      });
      dataServiceInitialized = true;
      setAppUser(null);
    }
  }, [isAuthenticated, auth0User, getIdTokenClaims]);

  const loginWithGoogle = async () => {
    // Specifically target Google connection if configured, otherwise generic login
    await loginWithRedirect({ 
      authorizationParams: { connection: 'google-oauth2' } 
    });
  };

  const loginWithEmail = async () => {
    // Standard Universal Login
    await loginWithRedirect();
  };

  const register = async () => {
    // Redirect to signup page
    await loginWithRedirect({ 
      authorizationParams: { screen_hint: 'signup' } 
    });
  };

  const logout = () => {
    auth0Logout({ 
      logoutParams: { returnTo: window.location.origin } 
    });
  };

  const clearError = () => {
    // Auth0 error is managed by the hook, but we can provide a no-op if downstream components expect it
  };

  return (
    <AuthContext.Provider value={{ 
      user: appUser, 
      isLoading: isAuth0Loading, 
      error: auth0Error ? auth0Error.message : null, 
      loginWithGoogle, 
      loginWithEmail, 
      register, 
      logout,
      clearError,
      setReloadTrigger: (callback) => {
        // Store the callback from App component
        if (typeof callback === 'function') {
          reloadTriggerCallback = callback;
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};