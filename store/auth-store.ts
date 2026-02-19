import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      
      setUser: (user) => set({ 
        user, 
        isAuthenticated: Boolean(user) 
      }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      logout: () => set({ 
        user: null, 
        isAuthenticated: false 
      }),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // noop; consumers can decide how to react
        }
        // set hasHydrated true after rehydrate completes
        // use timeout to ensure set runs after hydration
        setTimeout(() => {
          try {
            // Using a dynamic import to avoid capturing set from closure
            // but since we're inside create, we can directly call useAuthStore.setState
            useAuthStore.setState({ hasHydrated: true });
          } catch {}
        }, 0);
      },
    }
  )
);