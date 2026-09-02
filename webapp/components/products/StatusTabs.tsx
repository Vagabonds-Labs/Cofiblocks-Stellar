type ProductStatus = 'CREATION_REQUEST' | 'PUBLISHED' | 'HIDDEN'

export function StatusTabs({
  active,
  onChange,
  counts,
  t,
}: {
  active: ProductStatus
  onChange: (s: ProductStatus) => void
  counts: Record<ProductStatus, number>
  t: any
}) {
  const tabs: ProductStatus[] = [
    'CREATION_REQUEST',
    'PUBLISHED',
    'HIDDEN',
  ]

  return (
    <div className="flex gap-4 border-b overflow-x-auto">
      {tabs.map(status => {
        const isActive = active === status

        return (
          <button
            key={status}
            onClick={() => onChange(status)}
            className={`
              pb-2 whitespace-nowrap
              text-base font-medium
              transition
              ${
                isActive
                  ? 'border-b-2 border-orange-500 text-orange-600'
                  : 'text-gray-500 hover:text-gray-800'
              }
            `}
          >
            {t(`my_products.status.${status.toLowerCase()}`)}{' '}
            <span className="ml-1 text-sm text-gray-400">
              ({counts[status]})
            </span>
          </button>
        )
      })}
    </div>
  )
}
