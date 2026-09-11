'use client'

import { useState } from 'react'
import { KeyIcon } from '@heroicons/react/24/outline'
import { useExportWallet } from '@privy-io/react-auth/extended-chains'

/**
 * Exportar la clave privada de la wallet creada con email o Google.
 *
 * Es la salida del usuario si algún día deja CofiBlocks o Privy: con la clave
 * puede importar la cuenta en Freighter o LOBSTR. La clave se muestra en un
 * iframe de Privy en otro dominio; nuestra app nunca la ve.
 */
export function ExportWalletKey({
  walletAddress,
  t,
}: {
  walletAddress: string
  t: any
}) {
  const { exportWallet } = useExportWallet()
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setError(null)
    try {
      await exportWallet({ address: walletAddress })
    } catch (err: any) {
      console.error('Could not export wallet key', err)
      setError(err?.message || 'Could not export wallet key')
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-[#f7f9f6] p-4">
      <div className="flex items-start gap-3">
        <KeyIcon className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t('auth.export_key_title')}</h3>
          <p className="mt-1 text-sm text-gray-600">
            {t('auth.export_key_description')}
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleExport}
            className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t('auth.export_key_button')}
          </button>
        </div>
      </div>
    </div>
  )
}
