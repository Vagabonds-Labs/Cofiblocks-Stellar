export interface SummaryCardProps {
    subtotal: number;
    totalItems: number;
    deliveryPrice: number | null;
    totalPrice: number;
    t: (key: string) => string;
}

export function SummaryCard({ subtotal, totalItems, deliveryPrice, totalPrice, t }: SummaryCardProps) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-black mb-4">
          {t('checkout.summary')}
        </h2>
  
        <div className="space-y-3">
          <div className="flex justify-between">
            <span>{t('checkout.subtotal')}</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
  
          {deliveryPrice !== null && (
            <div className="flex justify-between">
              <span>{t('checkout.delivery_fee')}</span>
              <span>${deliveryPrice.toFixed(2)}</span>
            </div>
          )}
  
          <div className="flex justify-between">
            <span>{t('checkout.items')}</span>
            <span>{totalItems}</span>
          </div>
  
          <div className="border-t pt-3">
            <div className="flex justify-between font-bold text-xl">
              <span>{t('checkout.total')}:</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  