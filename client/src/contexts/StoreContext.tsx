import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Store {
  id: string;
  name: string;
}

interface StoreContextType {
  store: Store | null;
  isLoading: boolean;
  refetchStore: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const isSigninPage = location === "/signin";

  const {
    data: store,
    isLoading,
    refetch,
  } = useQuery<Store>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !isSigninPage, // 🔥 THIS IS THE LOOP FIX
  });

  return (
    <StoreContext.Provider
      value={{
        store: store ?? null,
        isLoading,
        refetchStore: async () => {
          await refetch();
        },
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
