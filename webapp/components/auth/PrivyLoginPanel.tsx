'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useLinkWithPasskey,
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithPasskey,
  usePrivy,
} from '@privy-io/react-auth'
import { FingerPrintIcon } from '@heroicons/react/24/outline'

import { usePrivyLogin } from '@/hooks/auth/usePrivyLogin'
import { PASSKEY_LOGIN_ENABLED, SOCIAL_LOGIN_ENABLED } from '@/lib/auth/loginMethods'

type Step = 'contact' | 'code' | 'passkey-setup'
type Provider = 'google' | 'apple' | 'twitter'

// Clases explícitas en vez de `.field-input` / `.btn-secondary` de globals.css:
// DaisyUI define clases con esos mismos nombres y las pisa (el input quedaba
// sin borde y los botones con otro estilo).
const INPUT_CLASS =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[rgb(var(--cb-text))] placeholder:text-gray-400 transition focus:border-[rgb(var(--cb-primary))] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--cb-primary)/0.15)]'

const SECONDARY_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 font-medium text-[rgb(var(--cb-text))] transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-gray-200 disabled:hover:bg-white'

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  )
}

function SocialButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={SECONDARY_BUTTON_CLASS}>
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </button>
  )
}

/**
 * Login sin wallet, con la UI propia en vez del modal de Privy.
 *
 * - Crear cuenta y entrar: con correo, pidiendo el código acá mismo.
 * - Volver a entrar más rápido: con passkey (huella, Face ID o PIN). Sólo
 *   entra; no crea cuentas. La passkey se crea después de un login con correo
 *   si el usuario marca "Usar passkey…", o más tarde desde el perfil.
 * - Google, Apple y X quedan detrás de `SOCIAL_LOGIN_ENABLED`.
 *
 * Lo que pasa después de autenticarse (crear la wallet, firmar y registrar) es
 * igual para todos y lo hace `usePrivyLogin`.
 */
export function PrivyLoginPanel({ onLoggedIn }: { onLoggedIn: () => void }) {
  const t = useTranslations()
  const { user } = usePrivy()

  const [step, setStep] = useState<Step>('contact')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [rememberPasskey, setRememberPasskey] = useState(false)
  // Se decide en el cliente: en el servidor no hay `window` y el HTML no
  // coincidiría al hidratar.
  const [passkeySupported, setPasskeySupported] = useState(false)

  useEffect(() => {
    setPasskeySupported(PASSKEY_LOGIN_ENABLED && typeof window !== 'undefined' && !!window.PublicKeyCredential)
  }, [])

  // Si pidió passkey y todavía no tiene una, antes de salir le ofrecemos
  // crearla. Va en un paso aparte, con su propio botón, porque el navegador
  // sólo deja crear una passkey en respuesta directa a un toque del usuario, y
  // para cuando termina el login ese toque ya venció.
  const handleLoggedIn = useCallback(() => {
    const hasPasskey = user?.linkedAccounts.some((account) => account.type === 'passkey')
    if (rememberPasskey && passkeySupported && !hasPasskey) {
      setStep('passkey-setup')
      return
    }
    onLoggedIn()
  }, [rememberPasskey, passkeySupported, user, onLoggedIn])

  const { ready, authenticated, isRegistering, error, setError, expectLogin } = usePrivyLogin(handleLoggedIn)
  const { initOAuth, state: oauthState } = useLoginWithOAuth()
  const emailLogin = useLoginWithEmail()
  const { loginWithPasskey } = useLoginWithPasskey()
  const { linkWithPasskey } = useLinkWithPasskey()

  const disabled = !ready || busy || isRegistering

  const run = async (action: () => Promise<void>, errorKey = 'auth.error_generic') => {
    setLocalError(null)
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err: any) {
      console.error('Login step failed', err)
      // Privy responde 403 `disallowed_login_method` cuando el método no está
      // activado en el dashboard. No es culpa del usuario: decirlo tal cual en
      // vez de sugerirle que revise su correo.
      const disabledMethod = err?.privyErrorCode === 'disallowed_login_method'
      setLocalError(t(disabledMethod ? 'auth.error_method_disabled' : errorKey))
    } finally {
      setBusy(false)
    }
  }

  const loginWithProvider = (provider: Provider) =>
    run(async () => {
      expectLogin()
      // Si ya hay sesión de Privy (por ejemplo, tras un error), no hace falta
      // volver a salir al proveedor: usePrivyLogin sigue desde ahí.
      if (authenticated) return
      await initOAuth({ provider })
    })

  const sendCode = (event?: FormEvent) => {
    event?.preventDefault()
    return run(async () => {
      await emailLogin.sendCode({ email: email.trim() })
      setStep('code')
    }, 'auth.error_send_email')
  }

  const verifyCode = (event: FormEvent) => {
    event.preventDefault()
    return run(async () => {
      expectLogin()
      await emailLogin.loginWithCode({ code: code.trim() })
    }, 'auth.error_code')
  }

  const loginWithPasskeyClick = () =>
    run(async () => {
      expectLogin()
      if (authenticated) return
      await loginWithPasskey()
    }, 'auth.error_passkey')

  const createPasskey = () =>
    run(async () => {
      await linkWithPasskey()
      onLoggedIn()
    }, 'auth.passkey_setup_error')

  const displayError =
    localError ??
    (error || oauthState.status === 'error' ? t('auth.error_generic') : null)

  const errorBox = displayError && (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{displayError}</div>
  )

  if (isRegistering) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[rgb(var(--cb-primary))] border-t-transparent" />
        <p className="font-medium text-[rgb(var(--cb-text))]">{t('auth.preparing_account')}</p>
      </div>
    )
  }

  if (step === 'passkey-setup') {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--cb-primary)/0.1)]">
          <FingerPrintIcon className="h-7 w-7 text-[rgb(var(--cb-primary))]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[rgb(var(--cb-text))]">{t('auth.passkey_setup_title')}</h2>
          <p className="mt-2 text-sm text-[rgb(var(--cb-muted))]">{t('auth.passkey_setup_description')}</p>
        </div>
        {errorBox}
        <button type="button" onClick={createPasskey} disabled={busy} className="btn-primary w-full py-3">
          {busy ? t('auth.passkey_setup_creating') : t('auth.passkey_setup_button')}
        </button>
        <button
          type="button"
          onClick={onLoggedIn}
          disabled={busy}
          className="text-sm text-[rgb(var(--cb-muted))] hover:text-[rgb(var(--cb-text))] disabled:opacity-50"
        >
          {t('auth.passkey_setup_skip')}
        </button>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        {errorBox}
        <p className="text-sm text-[rgb(var(--cb-muted))]">{t('auth.code_sent', { contact: email.trim() })}</p>
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          className={`${INPUT_CLASS} text-center text-2xl font-semibold tracking-[0.5em]`}
          aria-label={t('auth.code_label')}
        />
        <button type="submit" className="btn-primary w-full py-3" disabled={disabled || code.length < 6}>
          {busy ? t('auth.verifying') : t('auth.verify_code')}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('contact')
              setCode('')
              setLocalError(null)
            }}
            className="text-[rgb(var(--cb-muted))] hover:text-[rgb(var(--cb-text))]"
          >
            {t('auth.change_contact')}
          </button>
          <button
            type="button"
            onClick={() => sendCode()}
            disabled={disabled}
            className="font-medium text-[rgb(var(--cb-primary))] hover:underline disabled:opacity-50"
          >
            {t('auth.resend_code')}
          </button>
        </div>
      </form>
    )
  }

  const divider = (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-[rgb(var(--cb-muted))]">
      <div className="h-px flex-1 bg-gray-200" />
      {t('auth.divider_or')}
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )

  return (
    <div className="space-y-5">
      {errorBox}

      {SOCIAL_LOGIN_ENABLED && (
        <>
          <div className="grid gap-3">
            <SocialButton
              icon={<img src="/images/google-icon.png" alt="" className="h-5 w-5" />}
              label={t('auth.continue_with', { provider: 'Google' })}
              onClick={() => loginWithProvider('google')}
              disabled={disabled}
            />
            <SocialButton
              icon={<img src="/images/apple-logo.svg" alt="" className="h-5 w-5" />}
              label={t('auth.continue_with', { provider: 'Apple' })}
              onClick={() => loginWithProvider('apple')}
              disabled={disabled}
            />
            <SocialButton
              icon={<XLogo />}
              label={t('auth.continue_with', { provider: 'X' })}
              onClick={() => loginWithProvider('twitter')}
              disabled={disabled}
            />
          </div>
          {divider}
        </>
      )}

      <form onSubmit={sendCode} className="space-y-3">
        <label htmlFor="login-email" className="block text-sm font-medium text-[rgb(var(--cb-text))]">
          {t('auth.email_label')}
        </label>
        <input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t('auth.email_placeholder')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={INPUT_CLASS}
          required
        />
        {passkeySupported && (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-[rgb(var(--cb-muted))]">
            <input
              type="checkbox"
              checked={rememberPasskey}
              onChange={(event) => setRememberPasskey(event.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-[rgb(40,107,86)]"
            />
            <span>{t('auth.remember_passkey')}</span>
          </label>
        )}
        <button type="submit" className="btn-primary w-full py-3" disabled={disabled || !email.trim()}>
          {busy ? t('auth.sending_code') : t('auth.send_code')}
        </button>
      </form>

      {passkeySupported && (
        <>
          {divider}
          <button type="button" onClick={loginWithPasskeyClick} disabled={disabled} className={SECONDARY_BUTTON_CLASS}>
            <FingerPrintIcon className="h-5 w-5" />
            {t('auth.passkey_login')}
          </button>
        </>
      )}
    </div>
  )
}
