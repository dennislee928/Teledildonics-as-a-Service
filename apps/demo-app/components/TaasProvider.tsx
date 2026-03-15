"use client";

import React, { createContext, useContext, useMemo } from "react";
import { TaasClient } from "@taas/domain-sdk";

const TaasContext = createContext<TaasClient | null>(null);

export function TaasProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    // In a real app, these would come from env vars or a login state
    return new TaasClient({
      baseUrl: "https://teledildonics-as-a-service.onrender.com",
      apiKey: "taas_demo_workspace_key",
    });
  }, []);

  return (
    <TaasContext.Provider value={client}>
      {children}
    </TaasContext.Provider>
  );
}

export function useTaas() {
  const context = useContext(TaasContext);
  if (!context) {
    throw new Error("useTaas must be used within a TaasProvider");
  }
  return context;
}
