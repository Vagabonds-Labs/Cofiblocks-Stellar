/**
 * Métodos de login sin wallet (Privy) habilitados hoy.
 *
 * - Correo: el único para crear cuenta.
 * - Passkey: sólo para volver a entrar, más rápido. Se crea después del primer
 *   login (casilla "Usar passkey…" en la pantalla de login, o desde el perfil).
 *   En el dashboard de Privy: Passkeys activado para login, sin sign up.
 * - SMS: fuera. Privy sólo envía SMS a EE. UU. y Canadá; no sirve para Costa
 *   Rica.
 * - Google, Apple y X: fuera de la pantalla por ahora. Para habilitarlos:
 *   poner `SOCIAL_LOGIN_ENABLED` en `true` y activarlos en el dashboard de
 *   Privy (User management → Authentication → Socials).
 */
export const SOCIAL_LOGIN_ENABLED = false
export const PASSKEY_LOGIN_ENABLED = true

export type PrivyLoginMethod = 'email' | 'google' | 'apple' | 'twitter' | 'passkey'

export const PRIVY_LOGIN_METHODS: PrivyLoginMethod[] = [
  'email',
  ...(SOCIAL_LOGIN_ENABLED ? (['google', 'apple', 'twitter'] as const) : []),
  ...(PASSKEY_LOGIN_ENABLED ? (['passkey'] as const) : []),
]
