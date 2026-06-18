import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type User = {
  id: string;
  email: string | null;
  display_name: string | null;
  github_login: string | null;
  avatar_url: string | null;
  email_verified?: boolean;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
});

const TOKEN_KEY = "guardai_auth_token";

async function fetchUser(token: string): Promise<User | null> {
  try {
    const { getMe } = await import("./auth.functions");
    return await getMe({ headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    console.error("[Auth] Failed to fetch user:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser(token).then((u) => {
        setUser(u);
        if (!u) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [token]);

  function signIn(newToken: string) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
