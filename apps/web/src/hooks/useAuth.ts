import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@scrabble/shared';
import { fetchCurrentUser } from '../api/auth.js';

export function useAuth(): { user: PublicUser | null; loading: boolean; refresh: () => Promise<void> } {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await fetchCurrentUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, loading, refresh };
}
