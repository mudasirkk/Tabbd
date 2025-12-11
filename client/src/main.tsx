import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthProvider";
import { StoreProvider } from "@/contexts/StoreContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <StoreProvider>
          <App />
          <Toaster /> {/* Must be outside App for global toast visibility */}
        </StoreProvider>
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>
);
