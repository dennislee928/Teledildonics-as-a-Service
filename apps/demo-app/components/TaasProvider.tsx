"use client";

import React, { createContext, useContext, useMemo } from "react";
import { TaasClient } from "@taas/domain-sdk";

const TaasContext = createContext<TaasClient | null>(null);

const DEFAULT_API_URL = "https://teledildonics-as-a-service.onrender.com";

export function TaasProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    const baseUrl =
      typeof process !== "undefined" && process.env.NEXT_PUBLIC_TAAS_API_URL
        ? process.env.NEXT_PUBLIC_TAAS_API_URL
        : DEFAULT_API_URL;
    return new TaasClient({
      baseUrl,
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
