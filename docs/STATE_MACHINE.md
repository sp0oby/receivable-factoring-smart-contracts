# Factoring vault state machine

## Roles

| Role | Responsibility |
|------|----------------|
| Issuer (`ISSUER_ROLE` on `ReceivableNFT`) | Mints receivable NFTs with nominal, due date, debtor, commitment hash. |
| LP / depositor | Deposits ERC-20 into `FactoringVault` (ERC-4626), withdraws shares. |
| Seller | Holds receivable NFT until vault funds it; receives advance at discount. |
| Debtor | Repays face value (full or partial) into the vault for a funded receivable. |
| Oracle (`ORACLE_ROLE` on vault) | `OperatorOracle` (dev) or `FunctionsSettlement` (Chainlink callback path) calling `applyExternalSettlement`. |
| Observer | Anyone may call `markDefaulted` after maturity if the position is still active. |

## Invoice (receivable token) states

States are tracked in `FactoringVault` per `tokenId` (ERC-721 id from `ReceivableNFT`).

```text
None → Active → Repaid
           ↘ Defaulted
```

- **None**: NFT exists but vault has not funded it (`purchaseReceivable` not executed for this id).
- **Active**: Vault holds the NFT, advanced funds to seller, `remainingFace > 0` until repayment/default.
- **Repaid**: `remainingFace == 0`; collections credited to vault idle balance; NFT burned.
- **Defaulted**: Maturity passed while still **Active**; remaining face is written off (LPs absorb via share price); NFT burned.

## Pricing and utilization

- **TVL** (economic): `idle = asset.balanceOf(vault)` plus **outstanding face** `totalFaceOutstanding = Σ remainingFace`.
- **Utilization** (for discount curve): `utilizationBps = totalFaceOutstanding * 10_000 / (idle + totalFaceOutstanding)` (0 if denominator 0).
- **Discount**: `discountBps = Pricing.discountBps(utilizationBps, params)` monotonic in utilization.
- **Advance** paid to seller: `nominal * (10_000 - discountBps) / 10_000`.
- **Constraint**: After purchase, `newFace * 10_000 / (newIdle + newFace) <= maxUtilizationBps`.

`totalAssets()` for ERC-4626 is overridden as `idle + totalFaceOutstanding` so share price reflects funded receivables at face until default.

## Fund flows

1. **Mint**: Issuer mints NFT to seller with fixed terms.
2. **Fund** (`purchaseReceivable`): Seller transfers NFT to vault (or safe transfer); vault pays advance to seller; `remainingFace = nominal`; position **Active**; update utilization accounting.
3. **Repay** (`repay`): Debtor transfers asset to vault; reduces `remainingFace`; when zero → **Repaid**, burn NFT.
4. **Oracle settlement** (`applyExternalSettlement`): Same accounting as repay but callable only by `ORACLE_ROLE` (off-chain truth / Chainlink Functions result).
5. **Default** (`markDefaulted`): If `block.timestamp > due` and **Active**, write down `remainingFace` from TVL, burn NFT.

## Chainlink touchpoints

- **Functions** (`FunctionsSettlement`): **`sendSettlementRequest`** (legacy: one string arg = token id; repayment in JS source) or **`sendSettlementRequestWithRepay`** (two args). DON returns `abi.encode(tokenId, repaidAmount)`; fulfillment calls `applyExternalSettlement`. Pending `requestId → tokenId` prevents mismatched callbacks.
- **Automation** (`FactoringAutomation`, optional): `checkUpkeep` scans active ids for overdue **Active** positions; `performUpkeep` calls `markDefaulted` (relies on registrar forwarder on real networks).
- **Local / Anvil**: Use `OperatorOracle` instead of live DON; mock router in tests invokes `handleOracleFulfillment`.

## Failure / safety notes

- Reentrancy guarded on mutating external calls.
- ERC-4626 inflation: deploy script should seed an initial deposit or document virtual-offset behavior from OpenZeppelin v5.
- Oracle trust: `ORACLE_ROLE` holders can credit repayments—document for production (Chainlink DON + JS policy vs operator multisig).
