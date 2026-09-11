'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrivy, type User as PrivyUser } from '@privy-io/react-auth'
import { useCreateWallet, useSignRawHash } from '@privy-io/react-auth/extended-chains'

import { authService } from '@/services/auth'
import { signMessageWithPrivy } from '@/services/wallet/privySigner'

/**
 * Marca de "el usuario salió a loguearse". Google, Apple y X redirigen fuera de
 * la app y la página se recarga al volver, así que el estado de React no
 * alcanza para saber que hay un login en curso.
 */
const PENDING_KEY = 'cofiblocks:privy-login-pending'

function readPending(): boolean {
  try {
    return window.sessionStorage.getItem(PENDING_KEY) === '1'
  } catch {
    return false
  }
}

function writePending(value: boolean): void {
  try {
    if (value) window.sessionStorage.setItem(PENDING_KEY, '1')
    else window.sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // Sin sessionStorage (modo privado estricto) sólo se pierde la vuelta de OAuth.
  }
}

/** La wallet Stellar embebida del usuario de Privy, si ya la tiene. */
export function findStellarWallet(user: PrivyUser | null | undefined) {
  return user?.linkedAccounts.find(
    (account) =>
      account.type === 'wallet' &&
      account.chainType === 'stellar' &&
      (account.walletClientType?.startsWith('privy') ?? true)
  ) as { address: string } | undefined
}

/**
 * Cierre del login sin wallet (email, SMS, Google, Apple o X).
 *
 * Cómo se autentica el usuario lo decide la pantalla (`PrivyLoginPanel`); este
 * hook se ocupa de lo que pasa después, igual para todos los métodos: crearle
 * la cuenta Stellar (`G…`) la primera vez, firmar el nonce del backend en
 * formato SEP-53 y llamar a `register_wallet`. El backend no distingue esta
 * firma de la de Freighter; sólo guarda `walletProvider: 'privy'` para que el
 * webapp sepa con qué firmar después.
 *
 * La pantalla llama a `expectLogin()` antes de cada método. Recién cuando
 * Privy marca `authenticated`, este hook sigue.
 */
export function usePrivyLogin(onLoggedIn: () => void) {
  const { ready, authenticated, user, logout } = usePrivy()
  const { createWallet } = useCreateWallet()
  const { signRawHash } = useSignRawHash()

  // El usuario pidió entrar y todavía no terminamos de registrarlo.
  const [pending, setPending] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const registering = useRef(false)
  const creatingWallet = useRef(false)

  // Vuelta del redirect de Google, Apple o X.
  useEffect(() => {
    if (readPending()) setPending(true)
  }, [])

  const expectLogin = useCallback(() => {
    setError(null)
    writePending(true)
    setPending(true)
  }, [])

  const fail = useCallback(
    async (err: any) => {
      console.error('Privy login failed', err)
      setError(err?.message || 'Login failed')
      setIsRegistering(false)
      writePending(false)
      setPending(false)
      await logout().catch(() => {})
    },
    [logout]
  )

  const register = useCallback(
    async (address: string) => {
      if (registering.current) return
      registering.current = true
      setIsRegistering(true)
      try {
        const { nonce, message } = await authService.requestNonce(address)
        const signature = await signMessageWithPrivy(signRawHash, message, address)
        await authService.registerWallet(address, signature, nonce, 'privy')
        writePending(false)
        setPending(false)
        // Apagarlo antes de avisar: la pantalla puede seguir mostrando algo
        // (por ejemplo, el paso de crear la passkey) en vez de redirigir.
        setIsRegistering(false)
        onLoggedIn()
      } catch (err) {
        await fail(err)
      } finally {
        registering.current = false
      }
    },
    [signRawHash, onLoggedIn, fail]
  )

  useEffect(() => {
    if (!pending || !ready || !authenticated || !user) return

    const address = findStellarWallet(user)?.address
    if (address) {
      void register(address)
      return
    }

    // Primera vez: hay que crearle la wallet. No se firma en esta misma pasada:
    // el `signRawHash` de este render busca la wallet en el `user` de antes de
    // crearla y falla con "Wallet not found". `createWallet` refresca el
    // usuario de Privy, este efecto vuelve a correr con la wallet ya listada y
    // un `signRawHash` que la conoce, y ahí se firma.
    if (creatingWallet.current) return
    creatingWallet.current = true
    setIsRegistering(true)
    createWallet({ chainType: 'stellar' })
      .catch(fail)
      .finally(() => {
        creatingWallet.current = false
      })
  }, [pending, ready, authenticated, user, createWallet, register, fail])

  return { ready, authenticated, isRegistering, error, setError, expectLogin }
}
