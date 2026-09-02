// lib/hooks/useCavosSession.ts
"use client";

import { useOptionalCavos } from "./useOptionalCavos";

export function useCavosSession() {
  const { cavos: { isAuthenticated, address } } = useOptionalCavos();
  return {
    isCavosAuthenticated: isAuthenticated,
    cavosAddress: address,
  };
}
