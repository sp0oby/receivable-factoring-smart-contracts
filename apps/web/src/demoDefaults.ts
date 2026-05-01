import { vaultChainId } from './chains'

export const ZERO = `0x${'0'.repeat(40)}` as `0x${string}`

function isZeroAddr(a: string | undefined): boolean {
  if (!a || !a.startsWith('0x')) return true
  try {
    return BigInt(a) === 0n
  } catch {
    return true
  }
}

/** True when `VITE_*` was omitted, empty, or the zero address (demo should fall back on Sepolia). */
export function isUnsetOrZeroAddress(env: string | undefined): boolean {
  if (env === undefined || env.trim() === '') return true
  return isZeroAddr(env)
}

/**
 * Addresses from the reference Sepolia deployment (README). When you use Sepolia and
 * omit `VITE_OPERATOR_ORACLE` / `VITE_AUTOMATION`, these defaults apply so the demo works out of the box.
 * Deploy your own contracts and set env vars to override.
 */
export const REFERENCE_SEPOLIA = {
  operatorOracle: '0xf0a7AA9d95793DA05Ec07EAe5DDa23C1982AF0E8' as const,
  automation: '0xaa0beeAcCDE24B6e2783181b9A1326f25120A800' as const,
  functionsSettlement: '0xa061E09e19e636E4B27D76c2fe62a7A9D160b760' as const,
}

function pick(envRaw: string | undefined, fallback: `0x${string}`): `0x${string}` {
  if (!isZeroAddr(envRaw)) return envRaw as `0x${string}`
  if (vaultChainId === 11155111) return fallback
  return ZERO
}

export function resolvedOperatorOracle(envRaw: string | undefined) {
  return pick(envRaw, REFERENCE_SEPOLIA.operatorOracle)
}

export function resolvedAutomation(envRaw: string | undefined) {
  return pick(envRaw, REFERENCE_SEPOLIA.automation)
}

export function resolvedFunctionsSettlement(envRaw: string | undefined) {
  return pick(envRaw, REFERENCE_SEPOLIA.functionsSettlement)
}
