import { createContext, useContext, type ReactNode } from 'react';
import type { PublicUser } from '@scrabble/shared';
import { useAuth } from '../hooks/useAuth.js';

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext doit être utilisé à l’intérieur de <AuthProvider>.');
  return ctx;
}
