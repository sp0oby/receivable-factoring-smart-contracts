/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAULT_ADDRESS?: string
  readonly VITE_FUNCTIONS_ROUTER?: string
  readonly VITE_SEPOLIA_RPC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
