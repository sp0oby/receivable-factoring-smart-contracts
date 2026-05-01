import { http, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { defineChain, fallback } from 'viem'

export const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
})

/** Prefer `VITE_SEPOLIA_RPC` when set; otherwise try resilient public endpoints (avoid single-point `rpc.sepolia.org` failures). */
const sepoliaTransports = import.meta.env.VITE_SEPOLIA_RPC
  ? [
      http(import.meta.env.VITE_SEPOLIA_RPC),
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http('https://1rpc.io/sepolia'),
    ]
  : [
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http('https://1rpc.io/sepolia'),
      http('https://rpc.sepolia.org'),
    ]

/** Sepolia first so reads use the correct chain when the wallet is not connected yet (wagmi defaults to `chains[0]`). */
export const config = createConfig({
  chains: [sepolia, anvil],
  transports: {
    [anvil.id]: http(),
    [sepolia.id]: fallback(sepoliaTransports),
  },
})
