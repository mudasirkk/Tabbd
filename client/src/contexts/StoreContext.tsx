import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface Store {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

interface StoreContextType {
  store: Store | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetchStore: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setIsAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  // Fetch store info when authenticated
  const { data: store, isLoading: storeLoading, refetch } = useQuery<Store>({
    queryKey: ["/api/auth/me"],
    enabled: !!firebaseUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!firebaseUser) return null;
      
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch store");
      }

      return res.json();
    },
  });

  const refetchStore = async () => {
    await refetch();
  };

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !firebaseUser && window.location.pathname !== "/signin") {
      setLocation("/signin");
    }
  }, [firebaseUser, isAuthLoading, setLocation]);

  return (
    <StoreContext.Provider
      value={{
        store: store || null,
        isLoading: isAuthLoading || storeLoading,
        isAuthenticated: !!firebaseUser && !!store,
        refetchStore,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}