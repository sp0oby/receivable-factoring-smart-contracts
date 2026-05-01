/** Chain id where `VITE_VAULT_ADDRESS` lives. Default Sepolia (11155111); set `VITE_CHAIN_ID=31337` for local Anvil. */
export const vaultChainId = Number(import.meta.env.VITE_CHAIN_ID ?? '11155111')
