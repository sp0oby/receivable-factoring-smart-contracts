import * as React from 'react'
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { formatUnits, parseUnits, maxUint256 } from 'viem'
import { formatAmountForDisplay } from './formatDisplay'
import { vaultAbi, erc20Abi } from './abi'
import { vaultChainId } from './chains'
import {
  REFERENCE_SEPOLIA,
  isUnsetOrZeroAddress,
  resolvedAutomation,
  resolvedFunctionsSettlement,
  resolvedOperatorOracle,
  ZERO,
} from './demoDefaults'
import { FactoringPanel } from './FactoringPanel'
import { DocsView } from './DocsView'
import { githubRepoUrl, technicalDocsUrl } from './siteLinks'

const vaultAddress = (import.meta.env.VITE_VAULT_ADDRESS as `0x${string}` | undefined) ?? '0x0'
const functionsRouter = (import.meta.env.VITE_FUNCTIONS_ROUTER as `0x${string}` | undefined) ?? '0x0'

const operatorOracleResolved = resolvedOperatorOracle(import.meta.env.VITE_OPERATOR_ORACLE)
const automationResolved = resolvedAutomation(import.meta.env.VITE_AUTOMATION)
const functionsSettlementResolved = resolvedFunctionsSettlement(import.meta.env.VITE_FUNCTIONS_SETTLEMENT)

export default function App() {
  const [tab, setTab] = React.useState<'demo' | 'docs'>('demo')
  const chainId = useChainId()
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: switchPending } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const readEnabled = vaultAddress !== '0x0'

  const { data: assetAddr } = useReadContract({
    chainId: vaultChainId,
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'asset',
    query: { enabled: readEnabled },
  })

  const { data: decimals } = useReadContract({
    chainId: vaultChainId,
    address: assetAddr,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: !!assetAddr && assetAddr !== '0x0' },
  })

  const { data: totalAssets, refetch: refetchTA } = useReadContract({
    chainId: vaultChainId,
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'totalAssets',
    query: { enabled: readEnabled },
  })

  const { data: faceOut, refetch: refetchFace } = useReadContract({
    chainId: vaultChainId,
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'totalFaceOutstanding',
    query: { enabled: readEnabled },
  })

  const { data: shareBal, refetch: refetchShares } = useReadContract({
    chainId: vaultChainId,
    address: vaultAddress,
    abi: vaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && readEnabled },
  })

  const { data: walletBal, refetch: refetchBal } = useReadContract({
    chainId: vaultChainId,
    address: assetAddr,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!assetAddr && assetAddr !== '0x0' },
  })

  const { data: allowance, refetch: refetchAllow } = useReadContract({
    chainId: vaultChainId,
    address: assetAddr,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && vaultAddress ? [address, vaultAddress] : undefined,
    query: { enabled: !!address && readEnabled && !!assetAddr },
  })

  const dec = decimals ?? 18

  /** Dashboard display: grouped integer + trimmed fraction (avoids broken long decimals in narrow cards). */
  const fmt = (n: bigint | undefined) => formatAmountForDisplay(n, dec, 8)

  const fmtAllowance = (a: bigint | undefined) => {
    if (a === undefined) return '—'
    if (a === maxUint256 || a > maxUint256 - 10000n) {
      return 'Unlimited'
    }
    return formatAmountForDisplay(a, dec, 8)
  }

  async function refresh() {
    await Promise.all([refetchTA(), refetchFace(), refetchShares(), refetchBal(), refetchAllow()])
  }

  async function doApprove() {
    if (!assetAddr || vaultAddress === '0x0') return
    await writeContractAsync({
      chainId: vaultChainId,
      address: assetAddr,
      abi: erc20Abi,
      functionName: 'approve',
      args: [vaultAddress, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    })
    await refetchAllow()
  }

  async function doDeposit(raw: string) {
    if (!address || vaultAddress === '0x0' || !assetAddr) return
    const assets = parseUnits(raw, dec)
    await writeContractAsync({
      chainId: vaultChainId,
      address: vaultAddress,
      abi: vaultAbi,
      functionName: 'deposit',
      args: [assets, address],
    })
    await refresh()
  }

  async function doRedeem(raw: string) {
    if (!address || vaultAddress === '0x0') return
    const shares = parseUnits(raw, dec)
    await writeContractAsync({
      chainId: vaultChainId,
      address: vaultAddress,
      abi: vaultAbi,
      functionName: 'redeem',
      args: [shares, address, address],
    })
    await refresh()
  }

  const wrongNetwork = isConnected && chainId !== vaultChainId
  const vaultReadOk = vaultAddress !== '0x0'
  const sepoliaDefaultsActive =
    vaultChainId === 11155111 &&
    isUnsetOrZeroAddress(import.meta.env.VITE_OPERATOR_ORACLE) &&
    isUnsetOrZeroAddress(import.meta.env.VITE_AUTOMATION)

  return (
    <>
      <header className="app-header">
        <div className="app-header__row">
          <div className="app-header__brand">
            <p className="app-header__eyebrow">Reference demo</p>
            <h1>Receivable factoring</h1>
            <p className="tagline">
              Walk through a production-shaped flow: fund a pool, create and sell invoices, settle or default—without
              leaving a clean, minimal UI.
            </p>
          </div>
          <div className="app-header__links">
            <a className="ext-link" href={githubRepoUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="ext-link" href={technicalDocsUrl} target="_blank" rel="noreferrer">
              Technical docs
            </a>
          </div>
        </div>
        <nav className="app-tabs" aria-label="Main">
          <button
            type="button"
            className={tab === 'demo' ? 'app-tab app-tab--active' : 'app-tab'}
            onClick={() => setTab('demo')}
          >
            Demo
          </button>
          <button
            type="button"
            className={tab === 'docs' ? 'app-tab app-tab--active' : 'app-tab'}
            onClick={() => setTab('docs')}
          >
            Docs &amp; Chainlink
          </button>
        </nav>
      </header>

      {tab === 'docs' ? (
        <DocsView />
      ) : (
        <>
      <div className="lede">
        <p style={{ margin: '0 0 0.75rem' }}>
          <strong>For liquidity providers:</strong> add stablecoin-style funds to the pool and receive a share of the
          pool. You can take money back out by redeeming your share.
        </p>
        <p style={{ margin: 0 }}>
          <strong>For the demo story:</strong> create a sample invoice, sell it to the pool for an advance, then either
          pay it back as the debtor or use the operator tools to simulate a payment from your books. Technical contract
          names and addresses are tucked away at the bottom for developers.
        </p>
      </div>

      <p className="alert muted" style={{ marginBottom: '1rem' }}>
        <strong>Chainlink:</strong> wire Functions + Automation in the{' '}
        <button type="button" className="link-button" onClick={() => setTab('docs')}>
          Docs &amp; Chainlink
        </button>{' '}
        tab, then run the Foundry script to send a real settlement request.
      </p>

      {!vaultReadOk ? (
        <div className="alert warn">
          This page needs a pool address in configuration. Ask whoever deployed the demo, or set <code>VITE_VAULT_ADDRESS</code> in{' '}
          <code>apps/web/.env</code> and restart the dev server.
        </div>
      ) : null}

      {wrongNetwork ? (
        <div className="alert warn">
          Your wallet is on a different network than this demo expects. Switch to the network that matches this app
          (chain <strong>{vaultChainId}</strong>).
          <button
            type="button"
            className="btn"
            style={{ marginLeft: '0.75rem' }}
            disabled={switchPending}
            onClick={() => void switchChainAsync({ chainId: vaultChainId })}
          >
            {switchPending ? 'Switching…' : 'Switch network'}
          </button>
        </div>
      ) : null}

      <section className="card">
        <h2>Wallet</h2>
        {!isConnected ? (
          <button type="button" className="btn" onClick={() => connect({ connector: injected() })}>
            Connect wallet
          </button>
        ) : (
          <>
            <div className="wallet-bar">
              <span className="addr">{address}</span>
              <button type="button" className="btn btn--ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            </div>
            <p className="help" style={{ marginBottom: 0 }}>
              Connected network: <strong>{chainId}</strong> (demo targets <strong>{vaultChainId}</strong>)
            </p>
          </>
        )}
      </section>

      <section className="card">
        <h2>At a glance</h2>
        <p className="help">
          The pool’s total value includes cash sitting idle plus money still owed on active invoices. Your “share” is
          your piece of that total.
        </p>
        <div className="metric-grid">
          <div className="metric">
            <span className="label">Total pool value</span>
            <span className="value" title={totalAssets !== undefined ? formatUnits(totalAssets, dec) : undefined}>
              {fmt(totalAssets)}
            </span>
          </div>
          <div className="metric">
            <span className="label">Still owed on invoices</span>
            <span className="value" title={faceOut !== undefined ? formatUnits(faceOut, dec) : undefined}>
              {fmt(faceOut)}
            </span>
          </div>
          <div className="metric">
            <span className="label">Your pool share</span>
            <span className="value" title={shareBal !== undefined ? formatUnits(shareBal, dec) : undefined}>
              {fmt(shareBal)}
            </span>
          </div>
          <div className="metric">
            <span className="label">Cash in your wallet</span>
            <span className="value" title={walletBal !== undefined ? formatUnits(walletBal, dec) : undefined}>
              {fmt(walletBal)}
            </span>
          </div>
          <div className="metric">
            <span className="label">Pool can use your cash?</span>
            <span
              className="value"
              title={
                allowance === undefined
                  ? undefined
                  : allowance === maxUint256 || allowance > maxUint256 - 10000n
                    ? 'Unlimited (max allowance)'
                    : formatUnits(allowance, dec)
              }
            >
              {fmtAllowance(allowance)}
            </span>
          </div>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => void refresh()}>
          Refresh numbers
        </button>
      </section>

      <section className="card">
        <h2>Add or remove funds</h2>
        <p className="help">
          First allow the pool to move your cash (one-time step many wallets ask for). Then deposit an amount, or redeem
          your pool share to get cash back.
        </p>
        <VaultAction
          buttonLabel="Allow the pool to use my cash"
          disabled={!isConnected || wrongNetwork}
          onSubmit={() => void doApprove()}
        />
        <VaultAction
          fieldLabel="How much to add (same units as the pool asset)"
          buttonLabel="Add to pool"
          disabled={!isConnected || wrongNetwork}
          showInput
          onSubmit={(v) => void doDeposit(v)}
        />
        <VaultAction
          fieldLabel="How much of your pool share to cash out"
          buttonLabel="Withdraw from pool"
          disabled={!isConnected || wrongNetwork}
          showInput
          onSubmit={(v) => void doRedeem(v)}
        />
      </section>

      {vaultReadOk && assetAddr ? (
        <FactoringPanel
          vaultAddress={vaultAddress}
          assetAddress={assetAddr}
          address={address}
          isConnected={isConnected}
          wrongNetwork={wrongNetwork}
          dec={dec}
          onFactoringTx={refresh}
        />
      ) : null}

      <details className="tech-foot">
        <summary>Technical details (addresses, env vars)</summary>
        <p style={{ margin: '0.5rem 0' }}>
          {vaultChainId === 11155111 ? (
            <>
              On Sepolia, <code>VITE_OPERATOR_ORACLE</code> and <code>VITE_AUTOMATION</code> default to the reference
              deployment in the README when unset. Override them in <code>apps/web/.env</code> if you deployed your own
              contracts. Values match{' '}
              <a href="https://sepolia.etherscan.io/address/0xf0a7AA9d95793DA05Ec07EAe5DDa23C1982AF0E8" target="_blank" rel="noreferrer">
                OperatorOracle
              </a>{' '}
              and{' '}
              <a href="https://sepolia.etherscan.io/address/0xaa0beeAcCDE24B6e2783181b9A1326f25120A800" target="_blank" rel="noreferrer">
                FactoringAutomation
              </a>{' '}
              from the README table.
            </>
          ) : (
            <>
              Set <code>VITE_OPERATOR_ORACLE</code> and <code>VITE_AUTOMATION</code> from your deploy output (see README:
              <code>forge script</code> logs or <code>broadcast/…/run-latest.json</code>).
            </>
          )}
        </p>
        {sepoliaDefaultsActive ? (
          <p className="alert muted" style={{ margin: '0.5rem 0' }}>
            Using built-in Sepolia reference addresses for operator oracle and automation (see README deployment table).
          </p>
        ) : null}
        <dl>
          <dt>Pool (vault)</dt>
          <dd>{vaultAddress}</dd>
          <dt>Pool asset (token)</dt>
          <dd>{assetAddr ?? '—'}</dd>
          <dt>Operator oracle (resolved)</dt>
          <dd>{operatorOracleResolved === ZERO ? '—' : operatorOracleResolved}</dd>
          <dt>Automation (resolved)</dt>
          <dd>{automationResolved === ZERO ? '—' : automationResolved}</dd>
          <dt>Functions settlement (resolved)</dt>
          <dd>{functionsSettlementResolved === ZERO ? '—' : functionsSettlementResolved}</dd>
          <dt>Functions router (display)</dt>
          <dd>{functionsRouter === ZERO || functionsRouter === '0x0' ? '—' : functionsRouter}</dd>
          <dt>README Sepolia reference (oracle / automation / settlement)</dt>
          <dd>
            {REFERENCE_SEPOLIA.operatorOracle} / {REFERENCE_SEPOLIA.automation} / {REFERENCE_SEPOLIA.functionsSettlement}
          </dd>
        </dl>
      </details>
        </>
      )}

      <footer className="app-footer">
        Contracts and use cases:{' '}
        <a href={githubRepoUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
        . State machine and integration notes:{' '}
        <a href={technicalDocsUrl} target="_blank" rel="noreferrer">
          docs/
        </a>
        .
      </footer>
    </>
  )
}

function VaultAction({
  fieldLabel,
  buttonLabel,
  disabled,
  showInput,
  onSubmit,
}: {
  fieldLabel?: string
  buttonLabel: string
  disabled?: boolean
  showInput?: boolean
  onSubmit: (value: string) => void
}) {
  const [val, setVal] = React.useState('100')
  return (
    <div className="field" style={{ marginBottom: '1rem' }}>
      {showInput ? (
        <>
          <label>{fieldLabel ?? 'Amount'}</label>
          <input value={val} onChange={(e) => setVal(e.target.value)} disabled={disabled} />
        </>
      ) : null}
      <div>
        <button type="button" className="btn" disabled={disabled} onClick={() => onSubmit(val)}>
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
