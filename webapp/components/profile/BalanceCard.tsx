import { TokenMenu } from './TokenMenu'

interface BalanceCardProps {
  label: string
  amount: string
  color?: string
  showMenu?: boolean
  onTransfer?: () => void
  onSwap?: () => void
  t?: any
}

export function BalanceCard({ label, amount, color, showMenu, onTransfer, onSwap, t }: BalanceCardProps) {
    // Determine icon based on label (case-insensitive, handles translations)
    const labelUpper = label?.toUpperCase() || ''
    const img = labelUpper.includes('STARK') ? '/images/stark-icon.png' 
      : labelUpper.includes('USDT') ? '/images/usdt-icon.png' 
      : '/images/usdc-icon.png'
    return (
      <div
        className="
          relative
          flex flex-col items-center justify-center
          gap-3
          p-4
          rounded-2xl
          border border-gray-200
          bg-white
          text-center
        "
      >
        {/* Menu button - top right */}
        {showMenu && onTransfer && t && (
          <div className="absolute top-2 right-2">
            <TokenMenu onTransfer={onTransfer} onSwap={onSwap} t={t} />
          </div>
        )}

        {/* Token icon */}
        <div className="w-7 h-7 flex items-center justify-center">
          <img
            src={img}
            alt="Token icon"
            className="w-8 h-8"
          />
        </div>
  
        {/* Balance */}
        <span className="text-2xl font-semibold text-gray-900">
          {amount}
        </span>
  
        {/* Label */}
        <span className="text-xs uppercase tracking-wide text-gray-500">
          {label}
        </span>
      </div>
    )
  }
  