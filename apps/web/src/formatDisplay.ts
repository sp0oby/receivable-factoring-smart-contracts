import { formatUnits } from 'viem'

/**
 * Format token amounts for narrow dashboard cards: comma separators, capped fraction with ellipsis, no mid-digit line breaks.
 */
export function formatAmountForDisplay(
  amount: bigint | undefined,
  tokenDecimals: number,
  maxFractionDigits = 8
): string {
  if (amount === undefined) return '—'
  let s = formatUnits(amount, tokenDecimals)
  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  const [whole, frac = ''] = s.split('.')
  let f = frac.replace(/0+$/, '')
  if (maxFractionDigits >= 0 && f.length > maxFractionDigits) {
    f = `${f.slice(0, maxFractionDigits)}…`
  }
  const intGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  let out = f.length > 0 ? `${intGrouped}.${f}` : intGrouped
  if (neg) out = `-${out}`
  return out
}
