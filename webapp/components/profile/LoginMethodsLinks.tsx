'use client'

import { CheckCircleIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { usePrivy } from '@privy-io/react-auth'

import {
  PASSKEY_LOGIN_ENABLED,
  SOCIAL_LOGIN_ENABLED,
} from '@/lib/auth/loginMethods'

/**
 * Formas de iniciar sesión vinculadas a la cuenta.
 *
 * En Privy cada método de login es una cuenta distinta, con su propia wallet.
 * Si alguien entra con correo y otro día con Google, sin vincularlos vería otra
 * cuenta y otro saldo. Desde acá suma métodos a la cuenta que ya tiene: todos
 * entran a la misma wallet. También es donde se agrega una passkey si no se
 * creó al iniciar sesión.
 *
 * Sólo lista los métodos habilitados en `lib/auth/loginMethods`. No se ofrece
 * desvincular: con un solo método el usuario podría quedarse afuera de su
 * cuenta, y hoy no hace falta.
 */
export function LoginMethodsLinks({ t }: { t: any }) {
  const {
    ready,
    authenticated,
    user,
    linkEmail,
    linkGoogle,
    linkApple,
    linkTwitter,
    linkPasskey,
  } = usePrivy()

  if (!ready || !authenticated || !user) return null

  const passkeys = user.linkedAccounts.filter(
    (account) => account.type === 'passkey'
  ).length

  const methods: Array<{
    key: string
    label: string
    detail?: string | null
    linked: boolean
    link: () => void
  }> = [
    {
      key: 'email',
      label: t('auth.login_method_email'),
      detail: user.email?.address,
      linked: !!user.email,
      link: linkEmail,
    },
    ...(SOCIAL_LOGIN_ENABLED
      ? [
          {
            key: 'google',
            label: 'Google',
            detail: user.google?.email,
            linked: !!user.google,
            link: linkGoogle,
          },
          {
            key: 'apple',
            label: 'Apple',
            detail: user.apple?.email,
            linked: !!user.apple,
            link: linkApple,
          },
          {
            key: 'twitter',
            label: 'X (Twitter)',
            detail: user.twitter?.username ? `@${user.twitter.username}` : null,
            linked: !!user.twitter,
            link: linkTwitter,
          },
        ]
      : []),
    ...(PASSKEY_LOGIN_ENABLED
      ? [
          {
            key: 'passkey',
            label: t('auth.login_method_passkey'),
            detail:
              passkeys > 0
                ? t('auth.login_method_passkey_count', { count: passkeys })
                : null,
            linked: passkeys > 0,
            link: () => linkPasskey(),
          },
        ]
      : []),
  ]

  return (
    <div className="mt-5 border-t border-[#e5ebe6] pt-5 text-left">
      <div className="flex items-start gap-3">
        <UserCircleIcon className="mt-0.5 h-5 w-5 text-gray-500" />
        <div className="flex-1">
          <h3 className="font-semibold">{t('auth.login_methods_title')}</h3>
          <p className="mt-1 text-sm text-gray-600">
            {t('auth.login_methods_description')}
          </p>

          <ul className="mt-4 divide-y divide-gray-100">
            {methods.map((method) => (
              <li
                key={method.key}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {method.label}
                  </p>
                  {method.detail && (
                    <p className="truncate text-xs text-gray-500">
                      {method.detail}
                    </p>
                  )}
                </div>
                {method.linked ? (
                  <span className="flex items-center gap-1 text-xs text-green-700">
                    <CheckCircleIcon className="h-4 w-4" />
                    {t('auth.login_method_linked')}
                  </span>
                ) : (
                  <button
                    onClick={method.link}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    {t('auth.login_method_link')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
