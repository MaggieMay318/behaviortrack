import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";

interface AuthState {
  legacyToken: string | null;
  user: { id: number; email: string; name: string; role: string } | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState>({
  legacyToken: null,
  user: null,
  loading: true,
  error: null,
});

export function useLegacyToken() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const [state, setState] = useState<AuthState>({
    legacyToken: null,
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!clerkLoaded) return;

    if (!isSignedIn || !clerkUser) {
      setState({ legacyToken: null, user: null, loading: false, error: null });
      return;
    }

    const email = clerkUser.primaryEmailAddress?.emailAddress;
    const name =
      clerkUser.fullName ||
      clerkUser.primaryEmailAddress?.emailAddress?.split("@")[0] ||
      "Teacher";

    if (!email) {
      setState({ legacyToken: null, user: null, loading: false, error: "No email address found" });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    fetch("/api/auth/clerk-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.token) {
          setState({
            legacyToken: data.token,
            user: data.user,
            loading: false,
            error: null,
          });
        } else {
          setState({
            legacyToken: null,
            user: null,
            loading: false,
            error: data.error || "Failed to sync with server",
          });
        }
      })
      .catch((err) => {
        setState({
          legacyToken: null,
          user: null,
          loading: false,
          error: err.message || "Network error",
        });
      });
  }, [clerkLoaded, isSignedIn, clerkUser?.id]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
