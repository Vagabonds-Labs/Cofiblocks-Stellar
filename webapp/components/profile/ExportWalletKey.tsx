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
export function ExportWalletKey({ walletAddress, t }: { walletAddress: string; t: any }) {
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
    <div className="mt-8 border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <KeyIcon className="w-5 h-5 text-gray-500 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold">{t('auth.export_key_title')}</h3>
          <p className="text-sm text-gray-600 mt-1">{t('auth.export_key_description')}</p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <button
            onClick={handleExport}
            className="mt-3 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            {t('auth.export_key_button')}
          </button>
        </div>
      </div>
    </div>
  )
}
