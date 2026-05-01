import { REFERENCE_SEPOLIA } from './demoDefaults'
import { vaultChainId } from './chains'
import { githubRepoUrl, stateMachineDocUrl, technicalDocsUrl } from './siteLinks'

export function DocsView() {
  const isSepolia = vaultChainId === 11155111
  return (
    <div className="docs-view">
      <p className="docs-external-hint">
        <strong>Docs split:</strong> high-level contracts and scenarios live in the{' '}
        <a href={githubRepoUrl} target="_blank" rel="noreferrer">
          GitHub README
        </a>
        ; machine-readable technical notes are in{' '}
        <a href={technicalDocsUrl} target="_blank" rel="noreferrer">
          docs/
        </a>{' '}
        (<a href={stateMachineDocUrl} target="_blank" rel="noreferrer">
          state machine
        </a>
        ). This tab is the short operational guide for Chainlink wiring.
      </p>
      <section className="card">
        <h2>What this is for in the real world</h2>
        <p className="help">
          This demo is a <strong>receivable factoring</strong> toy model: a pool buys the right to collect on invoices (NFTs),
          sellers get early cash, debtors pay the pool later. In production, teams care about{' '}
          <strong>closing the loop when money actually moves off-chain</strong> — bank wires, card settlements, ERP “paid”
          flags, insurer or marketplace ledgers — without logging into a wallet for every invoice.
        </p>
        <h3>Where Chainlink fits</h3>
        <ul className="docs-list docs-list--plain">
          <li>
            <strong>Functions:</strong> Run small, audited JavaScript on Chainlink’s network to turn an{' '}
            <strong>API or file-backed signal</strong> (“invoice 123 was paid CHF 50k”) into a single on-chain action:{' '}
            <code>applyExternalSettlement</code>. Example sources: treasury HTTP API, accounting webhook (with auth in secrets),
            SFTP settlement CSV in a bucket, PSP settlement feed — whatever your lawyers and risk team approve.
          </li>
          <li>
            <strong>Automation:</strong> Call <code>performUpkeep</code> on a schedule so <strong>overdue defaults</strong> are
            processed even when nobody is at a keyboard — analogous to a collections/covenants job in traditional ops.
          </li>
          <li>
            <strong>Operator oracle (this repo):</strong> A simpler stand-in for “trusted back-office clicks paid” — good for
            staging; production often replaces or supplements it with Functions + policy.
          </li>
        </ul>
        <h3>Concrete product stories</h3>
        <ul className="docs-list docs-list--plain">
          <li>
            <strong>SME invoice marketplace:</strong> Buyer pays seller’s bank; Functions confirms payment in the bank or PSP
            API; pool marks the receivable paid and LPs’ NAV updates.
          </li>
          <li>
            <strong>Trade / supply-chain finance:</strong> Shipment + invoice due dates line up with a logistics or ERP system;
            repayment or default is fed from systems of record rather than manual Etherscan.
          </li>
          <li>
            <strong>RWA tokenization:</strong> Off-chain servicer reports cash sweeps; on-chain face value tracks the legal
            waterfall subject to your trust and legal structure (not legal advice — the contracts encode <em>one</em> accounting
            approach).
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Trust and safety — can someone drain the pool?</h2>
        <p className="help">
          <strong>Not from the open internet by “hacking Chainlink” alone.</strong> Random users cannot call{' '}
          <code>sendSettlementRequest</code> without <code>REQUESTER_ROLE</code>, cannot pull another person’s LP shares without
          their keys, and cannot mint invoices without <code>ISSUER_ROLE</code>. Standard ERC-4626 math still applies: you redeem
          <em>your</em> shares for a pro-rata claim on vault assets.
        </p>
        <p className="help">
          <strong>What <em>can</em> go wrong is mostly governance and oracle trust — same class of risk as any lending or RWA
          product.</strong> Anyone who can steer <strong>settlement truth</strong> (operator multisig, Functions JS + APIs you
          trust, compromised admin keys) could mark invoices paid incorrectly and move accounting in ways that hurt LPs — the
          protocol does not prove a bank statement is honest; it enforces <em>who</em> is allowed to say “paid” on-chain. A
          malicious <code>REQUESTER_ROLE</code> holder could also spam paid amounts that revert or waste LINK unless you monitor
          and revoke roles.
        </p>
        <p className="help">
          <strong>Chainlink’s job</strong> is reliable, agreed execution of <em>your</em> JS and delivery of the result to the
          consumer — not to validate that your ERP or bank feed is truthful. Production systems use multisigs, allowlists,
          circuit breakers, caps, audits, and legal agreements around who may trigger settlement.
        </p>
        <p className="alert muted">
          This repository is a <strong>reference / educational</strong> stack, not an audited product. Treat trust assumptions
          like production risk workstreams, not like “on-chain magic.”
        </p>
      </section>

      <section className="card">
        <h2>What you do on Chainlink’s sites</h2>
        <p className="help">
          The demo app talks to <strong>your deployed contracts</strong>. Chainlink runs separate dashboards for billing and
          scheduling. Complete these once per deployment (or reuse an existing subscription).
        </p>

        <h3>1. Functions — subscription and consumer</h3>
        <ol className="docs-list">
          <li>
            Open{' '}
            <a href="https://functions.chain.link/sepolia" target="_blank" rel="noreferrer">
              Chainlink Functions (Sepolia)
            </a>{' '}
            and connect the same wallet as your Foundry <code>PRIVATE_KEY</code>.
          </li>
          <li>
            Create a <strong>subscription</strong> and add <strong>test LINK</strong> so requests are paid.
          </li>
          <li>
            Copy the numeric <strong>subscription ID</strong> → set <code>FUNCTIONS_SUBSCRIPTION_ID</code> in the repo root{' '}
            <code>.env</code>.
          </li>
          <li>
            Add <strong>FunctionsSettlement</strong> as an <strong>allowed consumer</strong>. Reference deployment:{' '}
            <a
              href={`https://sepolia.etherscan.io/address/${REFERENCE_SEPOLIA.functionsSettlement}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="address-line">{REFERENCE_SEPOLIA.functionsSettlement}</span>
            </a>
            . Use your own address if you redeployed.
          </li>
          <li>
            Optional: paste the JS from <code>script/chainlink/functions-settlement-source.js</code> into the Functions UI and{' '}
            <strong>simulate</strong> with args <code>[tokenId, repayWei]</code> (decimal strings) before spending LINK.
          </li>
        </ol>

        <h3>2. Who can call Functions</h3>
        <p className="help">
          Only <strong>REQUESTER_ROLE</strong> on <code>FunctionsSettlement</code> may call <code>sendSettlementRequest</code>.
          The deploy script grants that to the deployer. Use the same key in Foundry, or have an admin grant the role to another
          address via Etherscan or <code>cast</code>.
        </p>

        <h3>3. Automation — recurring keeper</h3>
        <ol className="docs-list">
          <li>
            Open{' '}
            <a href="https://automation.chain.link" target="_blank" rel="noreferrer">
              Chainlink Automation
            </a>{' '}
            → <strong>Sepolia</strong>.
          </li>
          <li>
            Register <strong>custom logic</strong> targeting <strong>FactoringAutomation</strong> (
            <a href={`https://sepolia.etherscan.io/address/${REFERENCE_SEPOLIA.automation}`} target="_blank" rel="noreferrer">
              reference
            </a>
            ). Set gas per the UI; fund the upkeep with test LINK.
          </li>
          <li>
            Nodes call <code>checkUpkeep</code> / <code>performUpkeep</code> when there is work. The demo button runs{' '}
            <code>performUpkeep</code> once from your wallet for manual testing.
          </li>
        </ol>

        <h3>4. Sepolia reference constants</h3>
        <p className="help">
          Confirm on{' '}
          <a href="https://docs.chain.link/chainlink-functions/supported-networks" target="_blank" rel="noreferrer">
            supported networks
          </a>{' '}
          before mainnet.
        </p>
        <dl className="docs-dl">
          <dt>Functions router</dt>
          <dd className="address-line">0xb83E47C2bC239B3bf370bc41e1459A34b41238D0</dd>
          <dt>DON ID (Ethereum Sepolia 1)</dt>
          <dd className="address-line">
            0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000
          </dd>
        </dl>
        {!isSepolia ? (
          <p className="alert warn">
            This build targets chain <strong>{vaultChainId}</strong>. Override <code>FUNCTIONS_DON_ID</code> for other networks.
          </p>
        ) : null}
      </section>

      <section className="card">
        <h2>Foundry: send a Functions settlement</h2>
        <p className="help">
          This step is meant for <strong>Foundry (or any private key / backend you control)</strong>, not the demo web app.
          Chainlink Functions billing is tied to a <strong>subscription</strong> you fund from a wallet; source code and any API
          secrets stay off the public site. Only addresses with <code>REQUESTER_ROLE</code> may call{' '}
          <code>sendSettlementRequest*</code>, and this UI does not expose that call — use the script below with the same key
          you used when provisioning the consumer.
        </p>
        <p className="help">
          The <strong>reference</strong> <code>FunctionsSettlement</code> on Sepolia only supports the legacy{' '}
          <code>sendSettlementRequest(tokenId, subId, gas, donId, source)</code> — one Functions arg (token id).{' '}
          <code>SendFunctionsSettlement.s.sol</code> builds <strong>inline JS</strong> that embeds <code>FUNCTIONS_REPAY_WEI</code> so
          you do not need a second <code>args</code> entry. (Using the two-arg <code>functions-settlement-source.js</code> file +
          the old contract caused selector <code>0x6ca88079</code> reverts.)
        </p>
        <p className="help">
          If you <strong>redeploy</strong> <code>FunctionsSettlement</code> from this repo, it also has{' '}
          <code>sendSettlementRequestWithRepay</code>. Then use{' '}
          <code>SendFunctionsSettlementWithRepay.s.sol</code> with <code>script/chainlink/functions-settlement-source.js</code>{' '}
          (two string args).
        </p>
        <pre className="docs-pre">
          {`FUNCTIONS_SETTLEMENT=${REFERENCE_SEPOLIA.functionsSettlement}
FUNCTIONS_SUBSCRIPTION_ID=<your id>
SETTLEMENT_TOKEN_ID=1
FUNCTIONS_REPAY_WEI=1000000000000000000

# Optional: FUNCTIONS_CALLBACK_GAS_LIMIT=500000
# Optional: FUNCTIONS_DON_ID=0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000
# Optional: FUNCTIONS_JS_LEGACY_FILE=path/to/custom-one-arg-source.js

# Redeployed consumer only:
# forge script script/SendFunctionsSettlementWithRepay.s.sol:SendFunctionsSettlementWithRepay ...`}
        </pre>
        <pre className="docs-pre">
          {`forge script script/SendFunctionsSettlement.s.sol:SendFunctionsSettlement \\
  --rpc-url "$SEPOLIA_RPC_URL" \\
  --broadcast -vvv`}
        </pre>
        <p className="help">
          If the Functions UI says computation must return <code>Uint8Array</code> / <code>ArrayBuffer</code>, do not return a
          hex <code>string</code>. If the callback still reverts, raise <code>FUNCTIONS_CALLBACK_GAS_LIMIT</code> (e.g.{' '}
          <code>1000000</code>) and confirm <code>FUNCTIONS_REPAY_WEI</code> is not above the invoice&apos;s remaining face.
        </p>
      </section>

      <section className="card">
        <h2>Storyline checklist</h2>
        <ul className="docs-list docs-list--plain">
          <li>LP: add funds to the pool.</li>
          <li>Create invoice → sell to pool.</li>
          <li>Close out: debtor pay, operator record, or Functions script above.</li>
          <li>After due: mark defaulted and/or rely on Automation.</li>
        </ul>
      </section>
    </div>
  )
}
