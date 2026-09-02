import { writable } from 'svelte/store';

export interface User {
  id: number;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: string;
  prefs: Record<string, unknown>;
}
export interface Session { token: string | null; user: User | null }

const KEY = 'aviary-jwt';

function create() {
  const initial: Session = {
    token: typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null,
    user: null,
  };
  const { subscribe, set, update } = writable<Session>(initial);

  return {
    subscribe,
    login(token: string, user: User) {
      localStorage.setItem(KEY, token);
      set({ token, user });
    },
    setUser(user: User) { update((s) => ({ ...s, user })); },
    logout() {
      localStorage.removeItem(KEY);
      set({ token: null, user: null });
    },
  };
}

export const session = create();

/** Fetch /auth/me on boot when a token exists. */
export async function hydrateSession() {
  const token = localStorage.getItem(KEY);
  if (!token) return;
  try {
    const res = await fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('expired');
    session.login(token, await res.json());
  } catch {
    session.logout();
  }
}
