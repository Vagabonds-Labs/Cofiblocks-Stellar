import { PaymentToken } from "../types/contracts";


export function formatBalance(balance: string, token: PaymentToken): string {
  const n = BigInt(balance);

  let decimals = 0n;
  switch (token) {
    case PaymentToken.STRK:
      decimals = 18n;
      break;
    case PaymentToken.USDC:
    case PaymentToken.USDT:
      decimals = 6n;
      break;
  }

  const divisor = 10n ** decimals;

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
      return `${walletAddress.substring(0, 9)}...`
    }
  
    if (userName) {
      return userName.length > 7 ? `${userName.substring(0, 7)}...` : userName
    }
  
    return ''
  }

  /**
   * Formats an address for clipboard copying.
   * Ensures the address part (after 0x) is exactly 64 characters long
   * by padding with "00" at the front if needed.
   * 
   * @param address - The address to format (e.g., "0x123" or "0xabc...")
   * @returns The formatted address with 64 characters after "0x"
   */
  export function formatAddressForClipboard(address: string): string {
    if (!address) return address;
    
    // Remove 0x prefix if present
    const addressPart = address.startsWith('0x') ? address.slice(2) : address;
    
    // Calculate how many "00" pairs we need to add
    const currentLength = addressPart.length;
    const targetLength = 64;
    
    if (currentLength >= targetLength) {
      // If already long enough, return as is with 0x prefix
      return `0x${addressPart}`;
    }
    
    // Calculate padding needed
    const paddingNeeded = targetLength - currentLength;
    // Pad with "00" pairs (each pair is 2 characters)
    const paddingPairs = Math.ceil(paddingNeeded / 2);
    const padding = '00'.repeat(paddingPairs);
    
    // Take only the needed padding length
    const finalPadding = padding.slice(0, paddingNeeded);
    
    // Return formatted address with 0x prefix
    return `0x${finalPadding}${addressPart}`;
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
  