# Receivable factoring (smart contracts)

Reference Solidity stack for **invoice receivable factoring** on-chain: an **ERC-4626 vault** holds a single ERC-20 **asset**, buys **ERC-721 receivables** at a utilization-based discount, and tracks repayments, oracle settlement, and defaults. Fork this repo for the contracts; use the optional **React + wagmi** app in `apps/web` as a visual demo of vault + invoice flows.

## Where to read what

| If you want… | Open… |
|--------------|--------|
| **What each contract is for**, deploy commands, Sepolia addresses | This **README** (you are here). |
| **Real-world scenarios** (factoring, B2B pools, settlement patterns) | Sections **Real-world scenarios** and **Trust** below, plus the demo app’s **Docs & Chainlink** tab for Chainlink-specific notes. |
| **Technical behavior** (states, roles, flows, Chainlink touchpoints) | **[`docs/`](docs/)** — start with [**`docs/STATE_MACHINE.md`**](docs/STATE_MACHINE.md). |

## Real-world scenarios

Illustrative patterns only—not legal, compliance, or investment advice:

- **SME factoring:** A business mints a receivable NFT, sells it to the pool for an immediate advance, and the debtor pays the pool (or an operator records settlement from banking / ERP data).
- **B2B marketplaces:** Platform-issued invoices and a shared liquidity pool so LPs earn from a diversified book.
- **Programmatic lifecycle:** Defaults and write-downs are enforced on-chain after due dates so LP share price reflects outcomes consistently.
- **Off-chain payment → on-chain proof:** An **operator oracle** (demo) or **Chainlink Functions** (production-shaped) applies settlement when *your* approved policy says funds cleared.

## What you get

| Piece | Role |
|-------|------|
| **ReceivableNFT** | Issuer-minted receivable: `nominal`, `due`, `debtor`, commitment hash. Burn only through the vault after repaid/default. |
| **FactoringVault** | ERC-4626 over `asset`. `purchaseReceivable` moves the NFT to the vault and pays the seller a discounted advance. `totalAssets()` = idle ERC-20 + `totalFaceOutstanding`. `repay` (debtor) or `applyExternalSettlement` (oracle) reduce face; `markDefaulted` writes off overdue positions. |
| **Pricing** | Library: utilization → discount bps (floor / slope / cap). |
| **OperatorOracle** | Dev/demo path: operator transfers `asset` into the vault then calls `applyExternalSettlement`. |
| **FunctionsSettlement** | Chainlink Functions consumer: DON callback decodes `(tokenId, repaidAmount)` and settles on the vault. |
| **FactoringAutomation** | `checkUpkeep` / `performUpkeep` → `markDefaulted` for overdue invoices (register on Chainlink Automation for live networks). |

**Accounting:** LPs deposit into the vault; `totalFaceOutstanding` keeps funded invoice principal inside `totalAssets()` until repayment or default (default hits share price). Details: [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md).

**Trust:** Issuer, admin, oracle/operator, and any Functions JavaScript are trusted. Not audited—use for learning, prototypes, or as a baseline for your own review.

**Real-world framing & security:** For Chainlink-specific setup and trust boundaries, use the demo app **Docs & Chainlink** tab; for formal state/flow notes, see **[`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md)**.

## Fork & run (minimal)

1. **Tooling:** [Foundry](https://book.getfoundry.sh/), Node 20+, wallet with ETH on target testnet.
2. **Clone** with submodules, then build and test:

   ```bash
   git clone --recursive https://github.com/sp0oby/receivable-factoring-smart-contracts.git
   cd receivable-factoring-smart-contracts
   ```

   If you already cloned without `--recursive`, run: `git submodule update --init --recursive`.

3. Run `forge install` (if needed), `forge build`, and `forge test`.
4. **Deploy** (local or Sepolia) with the scripts in `script/`. Copy addresses into `.env` files.
5. **UI:** `cd apps/web && npm install && npm run dev` — set `apps/web/.env` from [apps/web/.env.example](apps/web/.env.example).

### Root `.env` (Foundry)

See [.env.example](.env.example). You need **`PRIVATE_KEY`** and an RPC (`SEPOLIA_RPC_URL` or local). For Sepolia deploy: **`ASSET_TOKEN`**, **`FUNCTIONS_ROUTER`** ([Chainlink Functions supported networks](https://docs.chain.link/chainlink-functions/supported-networks)). Add **`ETHERSCAN_API_KEY`** if you use `forge script ... --verify`.

### Web `.env` (public)

| Variable | Purpose |
|----------|---------|
| **`VITE_VAULT_ADDRESS`** | FactoringVault |
| **`VITE_CHAIN_ID`** | `11155111` (Sepolia, default) or `31337` (Anvil) |
| **`VITE_OPERATOR_ORACLE`** | OperatorOracle (operator panel in UI) |
| **`VITE_AUTOMATION`** | FactoringAutomation (`performUpkeep` demo) |
| **`VITE_FUNCTIONS_SETTLEMENT`** | Optional; shown in UI for reference / Etherscan |
| **`VITE_FUNCTIONS_ROUTER`** | Display only |
| **`VITE_SEPOLIA_RPC`** | Optional browser RPC (key is public if you use a provider URL) |

Restart `npm run dev` after editing `.env`.

### Where do `VITE_OPERATOR_ORACLE` and `VITE_AUTOMATION` come from?

1. **Your own deploy:** run the Foundry deploy script for your target network. The broadcast output prints each contract address; you can also read `broadcast/<ScriptName>/<chainId>/run-latest.json` and copy `transactions[*].contractAddress` for **`OperatorOracle`** and **`FactoringAutomation`**. Paste those into `apps/web/.env` as `VITE_OPERATOR_ORACLE` and `VITE_AUTOMATION`.

2. **Sepolia reference table (this repo):** the [Recorded Sepolia deployment](#recorded-sepolia-deployment-chain-11155111) section lists the same addresses. The demo UI also **falls back** to those addresses on chain `11155111` when the env vars are omitted or set to the zero address (`demoDefaults.ts`).

3. **Block explorer:** on Sepolia, open the vault from the table, then follow “contract” links from deploy txs or use Etherscan’s “contract creator” view for your deployer.

### Deploy commands (short)

**Local:** `anvil` then `forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast`

**Sepolia:** deploy mock asset if needed (`DeployMockAssetSepolia.s.sol`), then  
`forge script script/DeploySepolia.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast --verify -vvv`

### Recorded Sepolia deployment (chain 11155111)

| Item | Address |
|------|---------|
| Asset (SMA) | `0xA46Af17d1B3C0DfeeD0E5D8d6CEb8d49698D4de1` |
| Functions router | `0xb83E47C2bC239B3bf370bc41e1459A34b41238D0` |
| ReceivableNFT | `0x203F3687dEf60bc54280b78E6fe0d66FD26Db731` |
| FactoringVault | `0x4601B97eE914FDcd571546D48d6D5330B28928e4` |
| OperatorOracle | `0xf0a7AA9d95793DA05Ec07EAe5DDa23C1982AF0E8` |
| FunctionsSettlement | `0xa061E09e19e636E4B27D76c2fe62a7A9D160b760` |
| FactoringAutomation | `0xaa0beeAcCDE24B6e2783181b9A1326f25120A800` |

Etherscan: prefix each with `https://sepolia.etherscan.io/address/`.

### Can I test Chainlink Functions + Automation on Sepolia?

**Yes.** Sepolia is supported for both products, and this repo deploys **FunctionsSettlement** and **FactoringAutomation** against the same vault you use in the UI. There is no protocol reason you “can’t” test the full flow on Sepolia.

What is *not* automatic is the **Chainlink platform wiring**—that is always a separate step from `forge script`:

| Piece | What you do on Sepolia | Why the demo website doesn’t replace this |
|-------|------------------------|-------------------------------------------|
| **Functions** | Create a **Functions subscription**, fund **test LINK**, add **`FunctionsSettlement`** as **consumer**. For the **reference Sepolia** address in this README, run **`SendFunctionsSettlement.s.sol`** (legacy **5-arg** function; repayment is embedded in generated JS from `FUNCTIONS_REPAY_WEI`). After **redeploying** the consumer from this repo, use **`SendFunctionsSettlementWithRepay.s.sol`** and two-arg JS. | The browser must not hold subscription secrets or run unfunded public requests from `VITE_*`. |
| **Automation** | In the **Chainlink Automation** app, **register an upkeep** whose target is **`FactoringAutomation`**, set gas limits, and fund the upkeep with **LINK**. The network then calls **`checkUpkeep` / `performUpkeep`** when conditions are met. | The UI can call `performUpkeep` **manually**, but **scheduled, repeating** execution is Chainlink’s service; you register and pay for it on their side. |

So: **full E2E testing** uses the Forge script that matches your consumer’s ABI, plus the **Automation UI** for the keeper.

### Send a Functions settlement (Foundry)

Prerequisites: subscription with **LINK**, **`FunctionsSettlement`** as **consumer**, **`REQUESTER_ROLE`** on the signer.

**Reference README Sepolia** `FunctionsSettlement` (`0xa061…`) only has **`sendSettlementRequest(tokenId, subId, gasLimit, donId, source)`** — the script builds **inline JS** that reads **`args[0]`** only and bakes **`FUNCTIONS_REPAY_WEI`** into the source string (avoids the newer 6-argument selector your error hit).

| Variable | Notes |
|----------|--------|
| `FUNCTIONS_SETTLEMENT` | Consumer address |
| `FUNCTIONS_SUBSCRIPTION_ID` | From [functions.chain.link](https://functions.chain.link/sepolia) |
| `SETTLEMENT_TOKEN_ID` | Invoice id |
| `FUNCTIONS_REPAY_WEI` | Wei amount in generated JS |
| `FUNCTIONS_CALLBACK_GAS_LIMIT` | Optional (default `500000`; raise if callback reverts out-of-gas) |
| `FUNCTIONS_DON_ID` | Optional Sepolia default in script |
| `FUNCTIONS_JS_LEGACY_FILE` | Optional path to custom **single-arg** JS instead of inline |

```bash
forge script script/SendFunctionsSettlement.s.sol:SendFunctionsSettlement \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast -vvv
```

**New consumer** (redeployed from this repo): also has **`sendSettlementRequestWithRepay`** + two `args`. Re-add this address as consumer, then:

```bash
forge script script/SendFunctionsSettlementWithRepay.s.sol:SendFunctionsSettlementWithRepay \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast -vvv
```

Uses `FUNCTIONS_JS_PATH` (default `script/chainlink/functions-settlement-source.js`). Response must ABI-encode `(uint256, uint256)`.

## Demo app: proving the system end-to-end

The UI in **`apps/web`** includes:

1. **LP** — approve / deposit / redeem against the vault (ERC-4626).
2. **Factoring** — mint receivable (needs **`ISSUER_ROLE`**), NFT approval + `purchaseReceivable`, debtor **`repay`**, operator **`reportRepayment`** (needs **`OPERATOR_ROLE`** + env addresses), **`markDefaulted`**, optional **`performUpkeep`** (set **`VITE_AUTOMATION`**).
3. **Chainlink Functions** — subscription + consumer, then **`SendFunctionsSettlement.s.sol`** (reference legacy consumer) or **`SendFunctionsSettlementWithRepay.s.sol`** (redeployed consumer); response ABI-encodes two `uint256`s.

**How you know it works:** follow the numbered steps with a funded wallet; metrics (`totalFaceOutstanding`, position status, etc.) update on refresh. **`forge test`** includes unit/fuzz/invariant tests plus **`SepoliaForkSmokeTest`** (live read against your deployed vault when RPC is available).

## Tests & analysis

```bash
forge build
forge test
# Optional: live Sepolia read smoke (needs network)
forge test --match-contract SepoliaForkSmokeTest -vv
```

[Slither](https://github.com/crytic/slither): `pip install slither-analyzer` → `slither . --exclude-dependencies` (Foundry on `PATH`). Project config: [slither.config.json](slither.config.json) / inline `slither-disable-*` where patterns are intentional.

## Repository layout

```
src/           # Contracts (vault, NFT, pricing, oracle, chainlink)
script/        # Deploy / smoke scripts
test/          # Foundry tests (+ Sepolia fork smoke)
apps/web/      # Vite + React demo
docs/          # State machine & behavior notes
```

## License

SPDX per file (`MIT` unless noted).
