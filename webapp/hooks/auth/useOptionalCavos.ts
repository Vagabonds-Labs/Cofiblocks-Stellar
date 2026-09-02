'use client'

import { useCavos } from '@cavos/react'

const CAVOS_UNAVAILABLE_MESSAGE = 'Cavos login is currently unavailable.'

type CavosValue = ReturnType<typeof useCavos>

function unavailableError() {
  return new Error(CAVOS_UNAVAILABLE_MESSAGE)
}

function rejectUnavailable(): Promise<never> {
  return Promise.reject(unavailableError())
}

function throwUnavailable(): never {
  throw unavailableError()
}

const disabledCavos = {
  login: rejectUnavailable,
  sendMagicLink: rejectUnavailable,
  isAuthenticated: false,
  user: null,
  isLoading: false,
  address: null,
  signMessage: rejectUnavailable,
  logout: async () => undefined,
  execute: rejectUnavailable,
  getOnramp: throwUnavailable,
} as unknown as CavosValue

export function useOptionalCavos() {
  try {
    return {
      cavos: useCavos(),
      isCavosAvailable: true,
      unavailableMessage: null as string | null,
    }
  } catch {
    return {
      cavos: disabledCavos,
      isCavosAvailable: false,
      unavailableMessage: CAVOS_UNAVAILABLE_MESSAGE,
    }
  }
}
