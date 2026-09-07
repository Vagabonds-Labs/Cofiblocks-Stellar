'use client'

import { useState } from 'react'

/**
 * Formas de fondear la cuenta.
 *
 * El on-ramp con tarjeta se fue con Cavos: era su widget. Queda el bridge desde
 * otras cadenas, ahora con Stellar como destino.
 */
export function useFundingActions(user: any, t: any) {
  const [error, setError] = useState<string | null>(null)

  const handleFundByBridge = () => {
    // Lo abre FundingSection con el widget.
  }

  return { handleFundByBridge, error, setError }
}
