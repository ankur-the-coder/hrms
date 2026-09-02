/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import supabase from '../lib/supabase';
import { api } from '../lib/api';
import { useTheme, type Prefs } from '../theme/ThemeContext';

export interface Profile {
  id: number;
  tenant_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  prefs: Partial<Prefs> | null;
}

interface Ctx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Ctx>({ user: null, session: null, profile: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const hydrated = useRef(false);
  const profileRef = useRef<Profile | null>(null);

  const bootstrap = useCallback(async (u: User | null) => {
    if (!u?.email) { setProfile(null); profileRef.current = null; return; }
    try {
      const name = (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string) || '';
      const avatar = (u.user_metadata?.avatar_url as string) || '';
      const p = await api<Profile>(`bootstrap?email=${encodeURIComponent(u.email)}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}&auth_id=${u.id}`);
      setProfile(p);
      profileRef.current = p;
      if (!hydrated.current && p.prefs) {
        hydrated.current = true;
        theme.hydrate(p.prefs);
      }
    } catch (e) {
      console.error('bootstrap failed:', e);
    }
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      await bootstrap(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      await bootstrap(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [bootstrap]);

  // persist theme prefs to server (debounced) whenever they change
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onPrefs = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const p = profileRef.current;
      if (!p) return;
      clearTimeout(t);
      t = setTimeout(() => {
        api('bootstrap', { method: 'PUT', body: JSON.stringify({ id: p.id, prefs: detail }) }).catch(() => {});
      }, 700);
    };
    window.addEventListener('aviary:prefs', onPrefs);
    return () => { window.removeEventListener('aviary:prefs', onPrefs); clearTimeout(t); };
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
