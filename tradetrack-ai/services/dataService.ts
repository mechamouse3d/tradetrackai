/**
 * Data Service Layer
 * 
 * Handles switching between browser cache (demo mode) and API-based storage (authenticated users).
 * - Demo users: localStorage
 * - Authenticated users: PostgreSQL via backend API
 */

import { Transaction, WatchlistGroup } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface DataServiceConfig {
  isAuthenticated: boolean;
  auth0Token?: string; // Auth0 ID token from useAuth0
}

let config: DataServiceConfig = {
  isAuthenticated: false,
};

export const dataService = {
  /**
   * Initialize the data service with authentication config
   */
  initialize: (cfg: DataServiceConfig) => {
    config = cfg;
    if (cfg.isAuthenticated) {
      console.log('DataService initialized in AUTHENTICATED mode with token');
    } else {
      console.log('DataService initialized in DEMO mode');
    }
  },

  /**
   * Update auth token (call this when token refreshes)
   */
  updateToken: (token: string) => {
    config.auth0Token = token;
    console.log('Auth token updated');
  },

  /**
   * Sync user info to database (called on first Auth0 login)
   */
  syncUser: async (userData: {
    email: string;
    name: string;
    photoURL?: string;
  }): Promise<void> => {
    if (!config.isAuthenticated || !config.auth0Token) {
      console.error('syncUser called but not authenticated');
      throw new Error('Not authenticated');
    }

    try {
      console.log('Syncing user:', userData.email);
      const response = await fetch(`${API_BASE_URL}/users/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.auth0Token}`,
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('User sync failed:', response.status, errorBody);
        throw new Error(`Failed to sync user: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ User sync successful:', result);
    } catch (error) {
      console.error('❌ User sync error:', error);
      throw error;
    }
  },

  /**
   * Load transactions - from API if authenticated, localStorage if demo
   */
  loadTransactions: async (userId: string): Promise<Transaction[]> => {
    if (!config.isAuthenticated || userId === 'demo') {
      // Demo mode: load from localStorage
      const key = `transactions_${userId}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    }

    // Authenticated: load from API
    console.log(`[LOAD-API] Fetching transactions for authenticated user...`);
    const response = await fetch(`${API_BASE_URL}/transactions`, {
      headers: {
        Authorization: `Bearer ${config.auth0Token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[LOAD-API] Failed to fetch transactions:`, response.status, response.statusText);
      throw new Error(`Failed to load transactions: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Safely extract array regardless of how the backend wraps it
    let transactionsArray: Transaction[] = [];
    if (Array.isArray(data)) {
      transactionsArray = data;
    } else if (data && typeof data === 'object') {
      const arrayProp = Object.values(data).find(val => Array.isArray(val));
      if (Array.isArray(arrayProp)) transactionsArray = arrayProp;
      else if (Array.isArray(data.data)) transactionsArray = data.data;
      else if (Array.isArray(data.transactions)) transactionsArray = data.transactions;
    }

    console.log(`[LOAD-API] ✅ Fetched ${transactionsArray.length} transactions from API`);
    return transactionsArray;
  },

  /**
   * Save transactions - to API if authenticated, localStorage if demo
   */
  saveTransactions: async (
    userId: string,
    transactions: Transaction[]
  ): Promise<void> => {
    // Always use localStorage
    const key = `transactions_${userId}`;
    localStorage.setItem(key, JSON.stringify(transactions));
    console.log(`[SAVE] ✅ Saved ${transactions.length} transactions to localStorage`);
    
    if (!config.isAuthenticated || userId === 'demo') {
      return;
    }

    // Authenticated: also sync to API (in background, don't block)
    if (!config.auth0Token) {
      console.warn('⚠️ Authenticated mode but NO TOKEN');
      return;
    }

    try {
      console.log(`[dataService] Syncing ${transactions.length} transactions to API in background...`);
      
      // Strip temporary local IDs so the database can generate real UUIDs/CUIDs
      const safeTransactions = transactions.map(t => {
        if (t.id && t.id.length < 15) {
          const { id, ...rest } = t;
          return rest as Transaction;
        }
        return t;
      });

      const response = await fetch(`${API_BASE_URL}/transactions/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.auth0Token}`,
        },
        body: JSON.stringify({ transactions: safeTransactions }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('❌ API sync failed:', response.status, errorBody);
        return;
      }
      
      const result = await response.json();
      console.log('✅ API sync successful:', result);
    } catch (error) {
      console.error('❌ API sync error:', error);
    }
  },

  /**
   * Create a single transaction
   */
  createTransaction: async (transaction: Transaction): Promise<Transaction> => {
    if (!config.isAuthenticated) {
      // Demo mode: just return with ID
      return { ...transaction, id: Math.random().toString(36).substr(2, 9) };
    }

    // Authenticated: create via API
    const response = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.auth0Token}`,
      },
      body: JSON.stringify(transaction),
    });

    if (!response.ok) {
      throw new Error(`Failed to create transaction: ${response.statusText}`);
    }

    const json = await response.json();
    // Safely extract object if the backend wrapped it in { data: {...} } or { transaction: {...} }
    return json.data || json.transaction || json;
  },

  /**
   * Delete a transaction
   */
  deleteTransaction: async (transactionId: string): Promise<void> => {
    if (!config.isAuthenticated) {
      // Demo mode: just return (transaction already removed from state)
      return;
    }

    // Authenticated: delete via API
    const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${config.auth0Token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete transaction: ${response.statusText}`);
    }
  },

  /**
   * Load prices cache
   */
  loadPrices: async (userId: string): Promise<Record<string, number>> => {
    if (!config.isAuthenticated || userId === 'demo') {
      // Demo mode: load from localStorage
      const key = `prices_${userId}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : {};
    }

    // Authenticated: load from API
    const response = await fetch(`${API_BASE_URL}/prices`, {
      headers: {
        Authorization: `Bearer ${config.auth0Token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load prices: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Save prices cache
   */
  savePrices: async (
    userId: string,
    prices: Record<string, number>
  ): Promise<void> => {
    // TEMPORARY: Always use localStorage for now
    const key = `prices_${userId}`;
    localStorage.setItem(key, JSON.stringify(prices));
    console.log(`[dataService] Saved ${Object.keys(prices).length} prices to localStorage`);
    
    if (!config.isAuthenticated || userId === 'demo') {
      return;
    }

    // Authenticated: also sync to API (in background)
    if (!config.auth0Token) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/prices/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.auth0Token}`,
        },
        body: JSON.stringify({ prices }),
      });

      if (!response.ok) {
        console.error('❌ Price sync failed:', response.status);
        return;
      }
      
      console.log('✅ Price sync successful');
    } catch (error) {
      console.error('❌ Price sync error:', error);
    }
  },

  /**
   * Load user's watchlists
   */
  loadWatchlists: async (userId: string): Promise<WatchlistGroup[]> => {
    const key = `watchlists_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration from legacy flat string array
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && typeof parsed[0] === 'string') {
            return [{ id: 'default', name: 'My Watchlist', symbols: parsed }];
          }
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse watchlists", e);
      }
    }
    
    // Check for old legacy key before returning empty
    const legacyKey = `watchlist_${userId}`;
    const legacySaved = localStorage.getItem(legacyKey);
    if (legacySaved) {
      try {
        return [{ id: 'default', name: 'My Watchlist', symbols: JSON.parse(legacySaved) }];
      } catch (e) {}
    }
    
    return [{ id: 'default', name: 'My Watchlist', symbols: [] }];
  },

  /**
   * Save user's watchlists
   */
  saveWatchlists: async (userId: string, watchlists: WatchlistGroup[]): Promise<void> => {
    const key = `watchlists_${userId}`;
    localStorage.setItem(key, JSON.stringify(watchlists));
    console.log(`[dataService] Saved ${watchlists.length} watchlist groups to localStorage`);
  },
};
