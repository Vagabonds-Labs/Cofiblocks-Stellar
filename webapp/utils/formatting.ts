import { PaymentToken } from "../types/contracts";


/**
 * Todos los activos de Stellar usan 7 decimales, XLM y USDC incluidos. Antes
 * eran 18 para STRK y 6 para USDC.
 */
const STELLAR_DECIMALS = 7n;

export function formatBalance(balance: string, _token?: PaymentToken): string {
  const n = BigInt(balance);
  const divisor = 10n ** STELLAR_DECIMALS;

  const integerPart = n / divisor;
  const fractionalPart = n % divisor;

  // we want exactly 2 decimals, truncated (not rounded)
  const truncatedFraction =
    (fractionalPart * 100n) / divisor;

  const fractionStr = truncatedFraction
    .toString()
    .padStart(2, "0");

  if (fractionStr === "00") {
    return integerPart.toString();
  }

  return `${integerPart}.${fractionStr}`;
}

  
  export function formatDisplayName(walletAddress?: string | null, userName?: string | null): string {
    if (walletAddress) {
      // Las direcciones StrKey son largas y sin prefijo: se muestra la punta.
      return `${walletAddress.substring(0, 4)}…${walletAddress.slice(-4)}`
    }
  
    if (userName) {
      return userName.length > 7 ? `${userName.substring(0, 7)}...` : userName
    }
  
    return ''
  }

  /**
   * Las direcciones de Stellar son StrKey completas: se copian tal cual, sin
   * el relleno a 64 caracteres que hacía falta en Starknet.
   */
  export function formatAddressForClipboard(address: string): string {
    return address ?? '';
  }

  export const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  
  export const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)

  /**
   * Format date to dd/mm/yyyy format in the specified timezone
   */
  export const formatDateDDMMYYYY = (date: Date, timezone: string): string => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: timezone,
    })
    return formatter.format(date)
  }

  /**
   * Format event date/time with consistent rules:
   * - Shows only date if isAllDay is true (with "All Day" description)
   * - Shows only one date if start and end dates are equal
   * - Shows date range if dates are different
   * - Uses dd/mm/yyyy format
   * - All dates/times are formatted in the event's timezone
   */
  export const formatEventDateTime = (
    startAt: string,
    endAt: string | null,
    timezone: string,
    isAllDay: boolean
  ): string => {
    if (!startAt) return '-'
    
    const startDate = new Date(startAt)
    const startDateStr = formatDateDDMMYYYY(startDate, timezone)
    
    if (isAllDay) {
      return `${startDateStr} (All Day)`
    }
    
    const startTime = startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    })
    
    if (endAt) {
      const endDate = new Date(endAt)
      const endTime = endDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      })
      
      // Check if dates are different
      const startDateOnly = startDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timezone,
      })
      const endDateOnly = endDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timezone,
      })
      
      if (startDateOnly !== endDateOnly) {
        const endDateStr = formatDateDDMMYYYY(endDate, timezone)
        return `${startDateStr}, ${startTime} - ${endDateStr}, ${endTime}`
      }
      
      return `${startDateStr}, ${startTime} - ${endTime}`
    }
    
    return `${startDateStr}, ${startTime}`
  }
  