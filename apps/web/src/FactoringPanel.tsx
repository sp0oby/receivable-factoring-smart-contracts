import * as React from 'react'
import { useReadContract, useWriteContract } from 'wagmi'
import { formatUnits, keccak256, parseUnits, stringToHex, maxUint256 } from 'viem'
import {
  vaultAbi,
  receivableAbi,
  erc721Abi,
  erc20Abi,
  operatorOracleAbi,
  automationAbi,
} from './abi'
import { vaultChainId } from './chains'
import { resolvedAutomation, resolvedOperatorOracle, ZERO } from './demoDefaults'

const emptyBytes = '0x' as `0x${string}`

const posStatusHuman = ['No loan in pool yet', 'Active — pool advanced cash', 'Paid off', 'Written off after due date'] as const

function showError(e: unknown) {
  window.alert(e instanceof Error ? e.message : String(e))
}

function toBigIntLoose(v: bigint | number | undefined): bigint | undefined {
  if (v === undefined) return undefined
  return typeof v === 'bigint' ? v : BigInt(Math.trunc(v))
}

/** Human-readable due date; `0` means “unset / no invoice” — never show the 196970 epoch. */
function formatDue(unix: bigint | number | undefined): string {
  const u = toBigIntLoose(unix)
  if (u === undefined || u === 0n) return '—'
  const ms = Number(u) * 1000
  if (!Number.isFinite(ms)) return String(u)
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatAddr(a: `0x${string}` | undefined): string {
  if (!a) return '—'
  try {
    if (BigInt(a) === 0n) return '—'
  } catch {
    return String(a)
  }
  return a
}

function isZeroHex(a: `0x${string}` | undefined): boolean {
  if (!a) return true
  try {
    return BigInt(a) === 0n
  } catch {
    return true
  }
}

/** Trim paste noise (spaces, trailing colon) so wallet fields are less error-prone. */
function normalizeWalletInput(raw: string): string {
  return raw.trim().replace(/\s+/g, '').replace(/:+$/, '')
}

/** Full address with wrapping; hover shows same (for tools that use title). */
function AddrText({ addr }: { addr: `0x${string}` | undefined }) {
  const s = formatAddr(addr)
  if (s === '—') return <span>—</span>
  return (
    <span className="address-line" title={s}>
      {s}
    </span>
  )
}

export type FactoringPanelProps = {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}` | undefined
  address: `0x${string}` | undefined
  isConnected: boolean
  wrongNetwork: boolean
  dec: number
  onFactoringTx: () => Promise<void>
}

export function FactoringPanel({
  vaultAddress,
  assetAddress,
  address,
  isConnected,
  wrongNetwork,
  dec,
  onFactoringTx,
}: FactoringPanelProps) {
  const operatorOracleAddr = resolvedOperatorOracle(import.meta.env.VITE_OPERATOR_ORACLE)
  const automationAddr = resolvedAutomation(import.meta.env.VITE_AUTOMATION)

  const { writeContractAsync } = useWriteContract()
  const [tidStr, setTidStr] = React.useState('1')
  const tid = React.useMemo(() => {
    try {
      const n = BigInt(tidStr.trim() || '0')
      return n > 0n ? n : 0n
    } catch {
      return 0n
    }
  }, [tidStr])

  const rcEnabled = vaultAddress !== '0x0'
  const { data: receivableAddr } = useReadContract({
    chainId: vaultChainId,
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'receivable',
    query: { enabled: rcEnabled },
  })

  const re = (receivableAddr as `0x${string}` | undefined) ?? ZERO
  const reOk = re !== ZERO

  const { data: terms, refetch: refetchTerms } = useReadContract({
    chainId: vaultChainId,
    address: re,
    abi: receivableAbi,
    functionName: 'terms',
    args: tid > 0n ? [tid] : undefined,
    query: { enabled: reOk && tid > 0n },
  })

  const { data: position, refetch: refetchPos } = useReadContract({
    chainId: vaultChainId,
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'positions',
    args: tid > 0n ? [tid] : undefined,
    query: { enabled: rcEnabled && tid > 0n },
  })

  const { data: owner, refetch: refetchOwner } = useReadContract({
    chainId: vaultChainId,
    address: re,
    abi: erc721Abi,
    functionName: 'ownerOf',
    args: tid > 0n ? [tid] : undefined,
    query: { enabled: reOk && tid > 0n },
  })

  const { data: peek, refetch: refetchPeek } = useReadContract({
    chainId: vaultChainId,
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'peekNextDefaultable',
    query: { enabled: rcEnabled },
  })

  const { data: upkeep, refetch: refetchUpkeep } = useReadContract({
    chainId: vaultChainId,
    address: automationAddr,
    abi: automationAbi,
    functionName: 'checkUpkeep',
    args: [emptyBytes],
    query: { enabled: automationAddr !== ZERO },
  })

  const { data: allowOracle, refetch: refetchAllowOracle } = useReadContract({
    chainId: vaultChainId,
    address: assetAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && operatorOracleAddr !== ZERO ? [address, operatorOracleAddr] : undefined,
    query: { enabled: !!address && !!assetAddress && operatorOracleAddr !== ZERO },
  })

  async function refreshFactoring() {
    await Promise.all([
      refetchTerms(),
      refetchPos(),
      refetchOwner(),
      refetchPeek(),
      refetchUpkeep(),
      refetchAllowOracle(),
    ])
  }

  const dis = !isConnected || wrongNetwork

  const [mintNominal, setMintNominal] = React.useState('1000')
  const [mintDue, setMintDue] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 16)
  })
  const [mintDebtor, setMintDebtor] = React.useState('')
  const [mintTo, setMintTo] = React.useState('')
  const [commitNote, setCommitNote] = React.useState('invoice-ref-demo')

  const [repayAmt, setRepayAmt] = React.useState('100')
  const [oracleAmt, setOracleAmt] = React.useState('100')

  React.useEffect(() => {
    if (address) setMintTo((t) => (t === '' ? address : t))
    if (address) setMintDebtor((d) => (d === '' ? address : d))
  }, [address])

  async function doMint() {
    if (!address || !reOk) return
    const to = (normalizeWalletInput(mintTo) || address) as `0x${string}`
    const debtor = (normalizeWalletInput(mintDebtor) || address) as `0x${string}`
    const due = BigInt(Math.floor(new Date(mintDue).getTime() / 1000))
    const nominal = parseUnits(mintNominal, dec)
    const commitment = keccak256(stringToHex(commitNote || 'demo'))
    try {
      await writeContractAsync({
        chainId: vaultChainId,
        address: re,
        abi: receivableAbi,
        functionName: 'mint',
        args: [to, nominal, Number(due), debtor, commitment, ''],
      })
      await refreshFactoring()
      await onFactoringTx()
    } catch (e) {
      showError(e)
    }
  }

  async function doApproveVaultForNft() {
    if (!reOk) return
    try {
      await writeContractAsync({
        chainId: vaultChainId,
        address: re,
        abi: erc721Abi,
        functionName: 'setApprovalForAll',
        args: [vaultAddress, true],
      })
      await refreshFactoring()
    } catch (e) {
      showError(e)
    }
  }

  async function doPurchase() {
    try {
      await writeContractAsync({
        chainId: vaultChainId,
        address: vaultAddress,
        abi: vaultAbi,
        functionName: 'purchaseReceivable',
        args: [tid],
      })
      await refreshFactoring()
      await onFactoringTx()
    } catch (e) {
      showError(e)
    }
  }

  async function doRepay() {
    if (!address) return
    try {
      await writeContractAsync({
        chainId: vaultChainId,
        address: vaultAddress,
        abi: vaultAbi,
        functionName: 'repay',
        args: [tid, parseUnits(repayAmt, dec)],
      })
      await refreshFactoring()
      await onFactoringTx()
    } catch (e) {
      showError(e)
    }
  }

  async function doApproveOracle() {
    if (!assetAddress || operatorOracleAddr === ZERO) return
    try {
      await writeContractAsync({
        chainId: vaultChainId,
        address: assetAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [operatorOracleAddr, maxUint256],
      })
      await refetchAllowOracle()
    } catch (e) {
      showError(e)
    }
  }

  async function doOracleReport() {
    if (operatorOracleAddr === ZERO) return
    try {
      await writeContractAsync({
        chainId: vaultChainId,
        address: operatorOracleAddr,
        abi: operatorOracleAbi,
        functionName: 'reportRepayment',
        args: [tid, parseUnits(oracleAmt, dec)],
      })
      await refreshFactoring()
      await onFactoringTx()
    } catch (e) {
      showError(e)
    }
  }

  async function doMarkDefault() {
    try {
      await writeContractAsync({
        chainId: vaultChainId,
        address: vaultAddress,
        abi: vaultAbi,
        functionName: 'markDefaulted',
        args: [tid],
      })
      await refreshFactoring()
      await onFactoringTx()
    } catch (e) {
      showError(e)
    }
  }

  async function doPerformUpkeep() {
    if (automationAddr === ZERO || !upkeep) return
    const [needed, data] = upkeep
    if (!needed) {
      window.alert('Nothing for the automation robot to do right now (nothing overdue in this check).')
      return
    }
    try {
      await writeContractAsync({
        chainId: vaultChainId,
        address: automationAddr,
        abi: automationAbi,
        functionName: 'performUpkeep',
        args: [data],
      })
      await refreshFactoring()
      await onFactoringTx()
    } catch (e) {
      showError(e)
    }
  }

  const t0 = terms?.[0]
  const t1 = terms?.[1]
  const t2 = terms?.[2]
  const st = position?.[0]
  const mat = position?.[1]
  const posDeb = position?.[2]
  const rem = position?.[3]
  const peekNeed = peek?.[0]
  const peekTid = peek?.[1]

  const nominalBI = toBigIntLoose(t0)
  const dueBI = toBigIntLoose(t1)
  const debtorAddr = t2 as `0x${string}` | undefined
  const termsRowLoaded = terms !== undefined && nominalBI !== undefined
  const noInvoiceForId =
    termsRowLoaded && nominalBI === 0n && (dueBI === undefined || dueBI === 0n) && isZeroHex(debtorAddr)

  const fmtAllow = (a: bigint | undefined) => {
    if (a === undefined) return '—'
    if (a === maxUint256 || a > maxUint256 - 10000n) return 'Unlimited'
    return formatUnits(a, dec)
  }

  return (
    <section className="card" style={{ marginTop: '1.25rem' }}>
      <h2>Invoice demo</h2>
      <p className="help">
        Follow the steps in order: create an invoice, sell it to the pool for an advance, then close it out by paying as
        the debtor or recording a payment as the operator. Default handling appears after the due date.
      </p>

      <div className="row-actions">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Invoice number</label>
          <input value={tidStr} onChange={(e) => setTidStr(e.target.value)} style={{ maxWidth: '8rem' }} />
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => void refreshFactoring()}>
          Refresh status
        </button>
      </div>

      <div className="status-grid">
        <div className="status-card">
          <strong>Invoice</strong>
          {noInvoiceForId ? (
            <>
              No invoice exists with this number yet.
              {'\n'}
              Use step 1 below to create one, or enter a different invoice number.
            </>
          ) : terms && nominalBI !== undefined && !noInvoiceForId ? (
            <>
              Face amount: {formatUnits(nominalBI!, dec)}
              {'\n'}Due: {formatDue(t1)}
              {'\n'}Who pays:{' '}
              <AddrText addr={debtorAddr} />
              {'\n'}Current holder:{' '}
              {owner ? <AddrText addr={owner as `0x${string}`} /> : '—'}
            </>
          ) : (
            'Loading…'
          )}
        </div>
        <div className="status-card">
          <strong>Pool’s record of this invoice</strong>
          {position && st !== undefined ? (
            <>
              {posStatusHuman[Number(st)] ?? `Status ${st}`}
              {'\n'}Due (pool record): {formatDue(mat)}
              {'\n'}Debtor on file:{' '}
              <AddrText addr={posDeb as `0x${string}` | undefined} />
              {'\n'}Still owed: {rem !== undefined ? formatUnits(rem, dec) : '—'}
            </>
          ) : (
            '—'
          )}
        </div>
        <div className="status-card">
          <strong>Reminders</strong>
          {`Next overdue invoice (if any): ${peekNeed ? `#${peekTid}` : 'none'}
Scheduled keeper (optional): ${
            upkeep
              ? upkeep[0]
                ? 'ready to run a cleanup step'
                : 'idle (nothing to process)'
              : automationAddr === ZERO
                ? 'not configured for this network'
                : '—'
          }`}
        </div>
      </div>

      <div className="step">
        <h3>
          <span className="step-num">1</span>
          Create an invoice
        </h3>
        <p className="help">Usually an admin or issuer role. Pick amount, due date, who owes, and who receives the NFT.</p>
        <div className="form-grid-2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Invoice amount</label>
            <input value={mintNominal} onChange={(e) => setMintNominal(e.target.value)} disabled={dis} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Due date</label>
            <input type="datetime-local" value={mintDue} onChange={(e) => setMintDue(e.target.value)} disabled={dis} />
          </div>
        </div>
        <p className="help" style={{ margin: '0 0 0.85rem', fontSize: '0.78rem' }}>
          Same kind of units as the pool’s cash token ({dec} decimal places behind the scenes).
        </p>
        <div className="form-grid-2">
          <div className="field field--wide" style={{ marginBottom: 0 }}>
            <label>Who receives the invoice (seller wallet)</label>
            <input
              className="address-input"
              value={mintTo}
              onChange={(e) => setMintTo(e.target.value)}
              onBlur={() => setMintTo((t) => normalizeWalletInput(t))}
              disabled={dis}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
          <div className="field field--wide" style={{ marginBottom: 0 }}>
            <label>Who owes payment (debtor wallet)</label>
            <input
              className="address-input"
              value={mintDebtor}
              onChange={(e) => setMintDebtor(e.target.value)}
              onBlur={() => setMintDebtor((t) => normalizeWalletInput(t))}
              disabled={dis}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
        </div>
        <div className="field">
          <label>Private note (becomes an on-chain fingerprint only)</label>
          <input value={commitNote} onChange={(e) => setCommitNote(e.target.value)} disabled={dis} />
        </div>
        <button type="button" className="btn" disabled={dis || !reOk} onClick={() => void doMint()}>
          Create invoice
        </button>
      </div>

      <div className="step">
        <h3>
          <span className="step-num">2</span>
          Sell the invoice to the pool
        </h3>
        <p className="help">The seller lets the pool move the invoice, then receives an advance from the pool.</p>
        <button type="button" className="btn" disabled={dis || !reOk} onClick={() => void doApproveVaultForNft()}>
          Let the pool use this invoice
        </button>{' '}
        <button
          type="button"
          className="btn"
          disabled={dis || !owner || !address || owner.toLowerCase() !== address.toLowerCase()}
          onClick={() => void doPurchase()}
        >
          Sell to the pool for cash
        </button>
      </div>

      <div className="step">
        <h3>
          <span className="step-num">3</span>
          Pay back as the debtor
        </h3>
        <p className="help">Connect as the person who owes. Approve the pool to pull cash in the “Add or remove funds” section above.</p>
        <div className="row-actions">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Payment amount</label>
            <input value={repayAmt} onChange={(e) => setRepayAmt(e.target.value)} disabled={dis} />
          </div>
          <button type="button" className="btn" disabled={dis} onClick={() => void doRepay()}>
            Pay the pool
          </button>
        </div>
      </div>

      <div className="step">
        <h3>
          <span className="step-num">4</span>
          Record a payment (operator / back-office)
        </h3>
        <p className="help">
          For demos, a trusted operator records that money arrived another way. On Sepolia you can use the reference
          deployment without extra configuration.
        </p>
        {operatorOracleAddr === ZERO ? (
          <p className="alert warn">Operator tools are not available on this network unless you deploy and set addresses in your env file.</p>
        ) : (
          <>
            <p className="help">Permission for your wallet → payment desk: {fmtAllow(allowOracle)}</p>
            <button type="button" className="btn" disabled={dis} onClick={() => void doApproveOracle()}>
              Allow the payment desk to pull my cash
            </button>
            <div className="row-actions" style={{ marginTop: '0.75rem' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Recorded payment amount</label>
                <input value={oracleAmt} onChange={(e) => setOracleAmt(e.target.value)} disabled={dis} />
              </div>
              <button type="button" className="btn" disabled={dis} onClick={() => void doOracleReport()}>
                Record payment to the pool
              </button>
            </div>
          </>
        )}
      </div>

      <div className="step">
        <h3>
          <span className="step-num">5</span>
          After the due date
        </h3>
        <p className="help">Mark an invoice as defaulted only after it is truly overdue; the contract enforces the timing.</p>
        <button type="button" className="btn" disabled={dis} onClick={() => void doMarkDefault()}>
          Mark as defaulted
        </button>
        {automationAddr !== ZERO ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn--ghost" disabled={dis} onClick={() => void doPerformUpkeep()}>
              Run automated cleanup (if any)
            </button>
          </div>
        ) : null}
      </div>

      <details className="tech-foot">
        <summary>About “API settlement” (Chainlink) — optional, not this page</summary>
        <p className="help" style={{ marginTop: '0.5rem' }}>
          Some setups mark an invoice paid using data from the outside world (bank feed, ERP, and so on). Chainlink can
          carry that signal on-chain. This demo page does <strong>not</strong> start that flow: use the <strong>Docs &amp; Chainlink</strong> tab
          (subscription + Foundry script) or the README. The buttons above cover the normal paths: pay from the debtor wallet or record a
          payment as the operator.
        </p>
      </details>
    </section>
  )
}
