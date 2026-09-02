import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export function CheckoutHeader({ onBack, title }: { onBack: () => void, title: string }) {
    return (
      <>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>{title}</span>
        </button>
      </>
    )
  }
  