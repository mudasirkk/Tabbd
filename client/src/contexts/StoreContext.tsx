import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

/* ============================= TYPES ============================= */

interface Store {
  id: string;
  name: string;
}

interface StoreContextType {
  store: Store | null;
  isLoading: boolean;
  refetchStore: () => Promise<void>;
}

/* ============================= CONTEXT ============================= */

const StoreContext = createContext<StoreContextType | undefined>(undefined);

/* ============================= PROVIDER ============================= */

export function StoreProvider({ children }: { children: ReactNode }) {
  const {
    data: store,
    isLoading,
    refetch,
  } = useQuery<Store>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 5 * 60 * 1000,
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

/* ============================= HOOK ============================= */

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
