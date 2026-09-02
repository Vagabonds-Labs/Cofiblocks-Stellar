'use client'

import { useRouter } from 'next/navigation'
import {
  EllipsisHorizontalIcon,
  ArrowUpOnSquareIcon,
} from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useDeployProduct } from '@/hooks/products/useDeployProduct'

type MyProductRowProps = {
  product: any
  onDeploySuccess?: () => void
}

export function MyProductRow({
  product,
  onDeploySuccess,
}: MyProductRowProps) {
  const router = useRouter()
  const t = useTranslations()
  const { deploy, isDeploying } = useDeployProduct({
    product,
    onSuccess: onDeploySuccess,
  })

  const canDeploy = product.status === 'CREATION_REQUEST'

  return (
    <div
      onClick={() => router.push(`/seller/my-products/${product.id}`)}
      className="
        flex items-center gap-4
        p-4 rounded-xl
        border border-gray-200
        bg-white
        hover:bg-gray-50
        hover:shadow-md
        hover:border-gray-300
        transition-all duration-200
        cursor-pointer
      "
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : null}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {product.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          {product.farm?.name && (
            <>
              <span className="text-gray-700 font-medium">{product.farm.name}</span>
              <span>·</span>
            </>
          )}
          <span>${product.price}</span>
          <span>·</span>
          <span>Stock {product.currentStock}</span>
          {product.roastLevel && (
            <>
              <span>·</span>
              <span>Roast: {product.roastLevel}</span>
            </>
          )}
          {product.grindType && (
            <>
              <span>·</span>
              <span>Grind: {product.grindType}</span>
            </>
          )}
        </div>
      </div>

      {/* Deploy button */}
      {canDeploy && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            deploy().catch(err => {
              alert(
                err instanceof Error
                  ? err.message
                  : 'Failed to deploy product'
              )
            })
          }}
          disabled={isDeploying}
          className="
            flex items-center gap-1
            px-3 py-1.5
            text-xs font-medium
            rounded-md
            bg-orange-500 text-white
            hover:bg-orange-600
            transition
            whitespace-nowrap
            disabled:opacity-50
          "
        >
          <ArrowUpOnSquareIcon className="w-4 h-4" />
          {isDeploying ? t("my_products.deploying") : t("my_products.deploy")}
        </button>
      )}

      {/* Actions menu (future) */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="p-2 text-gray-400 hover:text-gray-700"
      >
        <EllipsisHorizontalIcon className="w-5 h-5" />
      </button>
    </div>
  )
}
