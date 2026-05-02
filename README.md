# Receivable factoring (smart contracts)

Reference Solidity stack for **invoice receivable factoring** on-chain: an **ERC-4626 vault** holds a single ERC-20 **asset**, buys **ERC-721 receivables** at a utilization-based discount, and tracks repayments, oracle settlement, and defaults. This repository is **contracts-first**: fork it for the Solidity, tests, and scripts—then wire your own frontend or automation.

## Where to read what

| If you want… | Open… |
|--------------|--------|
| **What each contract is for**, deploy commands, Sepolia addresses | This **README** (you are here). |
| **Real-world scenarios** (factoring, B2B pools, settlement patterns) | Sections **Real-world scenarios** and **Trust** below. |
| **Technical behavior** (states, roles, flows, Chainlink touchpoints) | **`docs/`** — start with **`docs/STATE_MACHINE.md`**. |
| **How to build a dapp UI** | Section **Building a UI** below. |

## Real-world scenarios

Illustrative patterns only—not legal, compliance, or investment advice:

- **SME factoring:** A business mints a receivable NFT, sells it to the pool for an immediate advance, and the debtor pays the pool (or an operator records settlement from banking / ERP data).
- **B2B marketplaces:** Platform-issued invoices and a shared liquidity pool so LPs earn from a diversified book.
- **Programmatic lifecycle:** Defaults and write-downs are enforced on-chain after due dates so LP share price reflects outcomes consistently.
- **Off-chain payment → on-chain proof:** An **operator oracle** or **Chainlink Functions** applies settlement when *your* approved policy says funds cleared.

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

**Token & indexing:** The vault `asset` must behave like a normal ERC-20 (no fee-on-transfer, no rebasing); see NatSpec on `FactoringVault`. For subgraphs and dashboards, emit coverage includes purchase/repay/default on the vault, mint/burn on `ReceivableNFT`, admin pricing updates on the vault, operator repayments on `OperatorOracle`, and request/apply events on `FunctionsSettlement`.

**Chainlink:** Subscription setup, legacy vs `WithRepay` consumers, and Foundry settlement scripts are documented in **Send a Functions settlement** below. Do not put subscription secrets or unfunded Functions requesters in a public browser bundle.

## Building a UI

Integrators usually expose **flows**, not raw contract names. Here is a practical map.

### 1. Which contracts to call

| Goal | Contract | Notes |
|------|-----------|--------|
| LP deposit / withdraw | **`FactoringVault`** | Standard **ERC-4626**: `asset()`, `deposit`, `mint`, `withdraw`, `redeem`. Users must **`approve`** the vault on the ERC-20 `asset` before `deposit` / `mint`. |
| Issue an invoice (NFT) | **`ReceivableNFT`** | **`mint(to, nominal, due, debtor, commitment, uri)`** — needs **`ISSUER_ROLE`**. Read terms with **`getTerms(tokenId)`** or **`terms`**. |
| Sell invoice to pool | **`FactoringVault`** | Seller **`setApprovalForAll(vault, true)`** (or per-token approve), then **`purchaseReceivable(tokenId)`**. |
| Debtor pays pool | **`FactoringVault`** | Debtor **`approve(vault, amount)`** on `asset`, then **`repay(tokenId, amount)`**. **`msg.sender` must be the position’s debtor** (snapshot at funding time). |
| Off-chain payment recorded | **`OperatorOracle`** | Operator ( **`OPERATOR_ROLE`**) calls **`reportRepayment(tokenId, amount)`**, which **`transferFrom`s** the operator’s allowance into the vault and calls **`applyExternalSettlement`**. Operator must **`approve`** the oracle on `asset`. |
| Mark overdue default | **`FactoringVault`** | **`markDefaulted(tokenId)`** — anyone can call **after maturity** while the position is **Active**. |
| Automation keeper | **`FactoringAutomation`** | **`checkUpkeep`** / **`performUpkeep`** — forwards to **`markDefaulted`** (used with Chainlink Automation on live nets). |

**Usually not from a public website:** **`sendSettlementRequest`** / **`sendSettlementRequestWithRepay`** on **`FunctionsSettlement`** — these need a **subscription-funded** signer with **`REQUESTER_ROLE`**; keep that in a **server, Foundry script, or KMS-backed wallet**, not in `NEXT_PUBLIC_*` / `VITE_*` env.

### 2. ABIs and bytecode

After `forge build`, pull JSON artifacts from **`out/`**:

```text
out/FactoringVault.sol/FactoringVault.json
out/ReceivableNFT.sol/ReceivableNFT.json
out/adapters/OperatorOracle.sol/OperatorOracle.json
out/chainlink/FactoringAutomation.sol/FactoringAutomation.json
out/chainlink/FunctionsSettlement.sol/FunctionsSettlement.json
```

Use the **`abi`** field with **ethers.js**, **viem**, **wagmi**, etc.

You can also print an ABI to the terminal:

```bash
forge inspect FactoringVault abi
forge inspect ReceivableNFT abi
```

### 3. Config your app needs

Keep **at least**:

- **RPC URL** for your chain (treat **browser-exposed** keys as public).
- **Chain ID** (e.g. `11155111` Sepolia, `31337` Anvil).
- **Contract addresses**: `FactoringVault`, `ReceivableNFT` (via **`vault.receivable()`**), `OperatorOracle`, `FactoringAutomation`, and optionally `FunctionsSettlement` for dashboards only.

Source addresses from your **`forge script` logs**, **`broadcast/.../run-latest.json`**, or the [Recorded Sepolia deployment](#recorded-sepolia-deployment-chain-11155111) table when experimenting.

### 4. Reads that power dashboards

On **`FactoringVault`**:

- **`totalAssets()`**, **`totalFaceOutstanding`**, **`asset()`**
- **`positions(tokenId)`** → `status`, `maturity`, `debtor`, `remainingFace` (`status`: `0` None, `1` Active, `2` Repaid, `3` Defaulted)
- **`peekNextDefaultable()`** — for “next upkeep” style UX

On **`ReceivableNFT`**: **`getTerms(tokenId)`** for nominal / due / debtor when the NFT is not yet funded.

**Decimals:** Always read **`decimals()`** on the vault **`asset`** when formatting amounts.

### 5. Suggested UX order (happy path)

1. Issuer mints receivable to seller.
2. LP deposits into vault (optional but typical before purchase).
3. Seller approves vault for NFT → **`purchaseReceivable`**.
4. Debtor **`repay`** *or* operator **`reportRepayment`** *or* (backend) Functions fulfillment → **`applyExternalSettlement`**.
5. If overdue and still active, **`markDefaulted`** (or Automation **`performUpkeep`**).

### 6. Implementation tips

- **Batch RPC calls** (viem **multicall**, ethers **`Multicall`**) for dashboards listing many `positions` / `terms`.
- **Indexers:** For history and searching by debtor, use **The Graph**, **Subsquid**, or a warehouse fed from events (`ReceivablePurchased`, `RepaymentApplied`, `ReceivableDefaulted`, etc.).
- **Wallets:** **WalletConnect / injected** for browsers; **privy / dynamic** patterns for onboarding—the vault does not care as long as you sign the right contract calls.
- **Testing:** Run **Anvil** locally with deploy scripts, or **fork Sepolia** and point at the README reference addresses for read-only integration tests.
- **Gas:** `purchaseReceivable` and first-time ERC-20 approves are multi-step; surface “approve then action” clearly in the UI.

For the full state diagram and economics, see **[`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md)**.

## Fork & run (minimal)

1. **Tooling:** [Foundry](https://book.getfoundry.sh/). Use **Node.js** only if you build a separate frontend.
2. **Clone** with submodules, then build and test:

   ```bash
   git clone --recursive https://github.com/sp0oby/receivable-factoring-smart-contracts.git
   cd receivable-factoring-smart-contracts
   ```

   If you already cloned without `--recursive`, run: `git submodule update --init --recursive`.

3. Run `forge install` (if needed), `forge build`, and `forge test`.
4. **Deploy** (local or Sepolia) with the scripts in `script/`. Copy addresses into `.env` for scripts (see [.env.example](.env.example)).

### Root `.env` (Foundry)

See [.env.example](.env.example). You need **`PRIVATE_KEY`** and an RPC (`SEPOLIA_RPC_URL` or local). For Sepolia deploy: **`ASSET_TOKEN`**, **`FUNCTIONS_ROUTER`** ([Chainlink Functions supported networks](https://docs.chain.link/chainlink-functions/supported-networks)). Add **`ETHERSCAN_API_KEY`** if you use `forge script ... --verify`.

### Finding contract addresses after deploy

1. **Your own deploy:** use `forge script` logs or `broadcast/<ScriptName>/<chainId>/run-latest.json` and copy `transactions[*].contractAddress` for **`FactoringVault`**, **`ReceivableNFT`**, **`OperatorOracle`**, **`FactoringAutomation`**, **`FunctionsSettlement`**.
2. **Sepolia reference:** see [Recorded Sepolia deployment](#recorded-sepolia-deployment-chain-11155111).
3. **Block explorer:** open the vault, then trace contract creation / internal txs.

### Deploy commands (short)

**Local:** `anvil` then `forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast`

**Sepolia:** deploy mock asset if needed (`DeployMockAssetSepolia.s.sol`), then  
`forge script script/DeploySepolia.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast --verify -vvv`

### Recorded Sepolia deployment (chain 11155111)

Latest table from **`DeploySepolia.s.sol`** (May 2026). If you deploy again, replace these from your `run-latest.json` / script logs.

| Item | Address |
|------|---------|
| Asset (SMA) | `0xA46Af17d1B3C0DfeeD0E5D8d6CEb8d49698D4de1` |
| Functions router | `0xb83E47C2bC239B3bf370bc41e1459A34b41238D0` |
| ReceivableNFT | `0x6FE9B7C10cbC3064F312FfA1197871F5A5E40030` |
| FactoringVault | `0x4D168e17443454590ff97206789E458e457dFB81` |
| OperatorOracle | `0x2207e3A3117F219636F42b9209d021b73811485C` |
| FunctionsSettlement | `0xeB59985C4DfCbE6D7a54D909b3A43B0ABF8ae894` |
| FactoringAutomation | `0xf410739Ee42CD97d18ed419Db739F0BB8CB21B6E` |

Etherscan: prefix each with `https://sepolia.etherscan.io/address/`.

### Can I test Chainlink Functions + Automation on Sepolia?

**Yes.** Sepolia is supported for both products, and this repo deploys **FunctionsSettlement** and **FactoringAutomation** against the same vault.

What is *not* automatic is the **Chainlink platform wiring**—that is always a separate step from `forge script`:

| Piece | What you do on Sepolia | Note |
|-------|------------------------|------|
| **Functions** | Create a **subscription**, fund **test LINK**, add **`FunctionsSettlement`** (address in the table) as **consumer**. This deployment’s consumer supports **`sendSettlementRequestWithRepay`** (two string args + `functions-settlement-source.js`) and the legacy **`sendSettlementRequest`** (one arg; repayment baked into inline JS — **`SendFunctionsSettlement.s.sol`**). | Run requests from a **trusted wallet / backend**, not a public site. |
| **Automation** | Register an **upkeep** on **`FactoringAutomation`**, fund **LINK**. | The network calls **`checkUpkeep` / `performUpkeep`**. |

So: **full E2E testing** uses the Forge script that matches your consumer’s ABI, plus the **Automation** app for scheduled **`performUpkeep`**.

### Send a Functions settlement (Foundry)

Prerequisites: subscription with **LINK**, **`FunctionsSettlement`** as **consumer**, **`REQUESTER_ROLE`** on the signer.

**This table’s** `FunctionsSettlement` supports **`sendSettlementRequestWithRepay`** (preferred: **`SendFunctionsSettlementWithRepay.s.sol`** + `script/chainlink/functions-settlement-source.js`). It also exposes the legacy **`sendSettlementRequest(tokenId, subId, gasLimit, donId, source)`** for one-arg JS — use **`SendFunctionsSettlement.s.sol`**, which embeds **`FUNCTIONS_REPAY_WEI`** in generated source. **Third-party deployments** may only implement one path; match the script to the ABI you actually deployed.

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

**Recommended:** `sendSettlementRequestWithRepay` + two `args`. Re-add the **consumer address from the table** to your subscription, then:

```bash
forge script script/SendFunctionsSettlementWithRepay.s.sol:SendFunctionsSettlementWithRepay \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast -vvv
```

Uses `FUNCTIONS_JS_PATH` (default `script/chainlink/functions-settlement-source.js`). Response must ABI-encode `(uint256, uint256)`.

## Proving it works

- **`forge test`** — unit, fuzz, and invariant tests.
- **`SepoliaForkSmokeTest`** — optional live read against a deployed vault when RPC is set (`forge test --match-contract SepoliaForkSmokeTest -vv`).
- **`script/DevSmoke.s.sol`** — scripted flows after local deploy.

## Tests & analysis

```bash
forge build
forge test
# Optional: live Sepolia read smoke (needs network)
forge test --match-contract SepoliaForkSmokeTest -vv
```

[Slither](https://github.com/crytic/slither): `pip install slither-analyzer`, ensure **`forge`** is on `PATH` (e.g. `~/.foundry/bin`), then from the repo root:

```bash
python -m slither . --config-file slither.config.json --compile-force-framework foundry
```

`pragma` / `solc-version` / dependency noise / informational **`reentrancy-events`** (events after external calls in oracle/Functions callbacks; vault paths use `nonReentrant`) are filtered via [`slither.config.json`](slither.config.json). Target **`0` high/medium findings** before a production release; open an issue if Slither reports anything else.

## Repository layout

```
src/           # Contracts (vault, NFT, pricing, oracle, chainlink)
script/        # Deploy / smoke scripts
test/          # Foundry tests (+ Sepolia fork smoke)
docs/          # State machine & behavior notes
```

If you still have a local **`apps/web/node_modules`** folder from an older checkout, it is no longer part of this repo—delete **`apps/web`** after closing any dev server that might lock native binaries on Windows.

## License

SPDX per file (`MIT` unless noted).
