import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtMon, hasContract, publicClient, short } from '../lib/chain'
import { getBurner, requestFunding } from '../lib/wallet'

type Step = 'wallet' | 'funding' | 'ready' | 'error'

const StepRow = ({ done, active, label }: { done: boolean; active: boolean; label: string }) => (
  <div className="join-step">
    <span className={`join-step-dot ${done ? 'is-done' : active ? 'is-active' : ''}`}>
      {done ? '✓' : active ? '•' : ''}
    </span>
    <span className={done || active ? 'text-white' : 'text-dim'}>{label}</span>
  </div>
)

export default function Join() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('wallet')
  const [address, setAddress] = useState<string>('')
  const [balance, setBalance] = useState<bigint>(0n)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const run = async () => {
      const account = getBurner()
      if (!alive) return
      setAddress(account.address)

      try {
        const existing = await publicClient.getBalance({ address: account.address })
        if (!alive) return
        setBalance(existing)

        if (existing > 0n) {
          setStep('ready')
          return
        }

        setStep('funding')
        const result = await requestFunding(account.address)
        if (!alive) return
        if (!result.ok) throw new Error(result.error ?? 'funding failed')

        // Wait for the drip to land. Monad blocks are ~400ms, so this is quick.
        for (let i = 0; i < 40; i++) {
          const next = await publicClient.getBalance({ address: account.address })
          if (!alive) return
          if (next > 0n) {
            setBalance(next)
            setStep('ready')
            return
          }
          await new Promise((r) => setTimeout(r, 400))
        }
        throw new Error('funding did not land in time')
      } catch (e) {
        if (!alive) return
        setError((e as Error).message)
        setStep('error')
      }
    }

    void run()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (step !== 'ready') return
    const handle = setTimeout(() => navigate('/m'), 700)
    return () => clearTimeout(handle)
  }, [step, navigate])

  return (
    <main className="page-shell join-shell">
      <header className="space-y-5">
        <p className="eyebrow">Monad testnet social betting</p>
        <div className="space-y-3">
          <h1 className="hero-mark">
            CLUTCH
            <span>scroll reels, bet the outcome</span>
          </h1>
          <p className="hero-copy">
            Watch reels inside Clutch and bet on whether they hit view, like, or comment targets
            before the clock runs out. We create a burner wallet, drop in testnet MON, and send you
            into the live feed.
          </p>
        </div>
        <div className="signal-row">
          <div className="signal-pill">
            <span className="status-dot" />
            <span>real Monad transactions</span>
          </div>
          <div className="signal-pill">
            <span className="nums">~0.2 MON</span>
            <span>starter bankroll</span>
          </div>
        </div>
      </header>

      <section className="section-card join-stage">
        <div className="join-stage-grid">
          <div>
            <p className="meta-label">Join sequence</p>
            <div className="space-y-4">
              <StepRow
                done={step !== 'wallet'}
                active={step === 'wallet'}
                label="Creating your burner wallet"
              />
              <StepRow
                done={step === 'ready'}
                active={step === 'funding'}
                label="Dropping in testnet MON"
              />
              <StepRow done={step === 'ready'} active={false} label="Routing you into the Clutch feed" />
            </div>
          </div>
          <div className="join-meta-grid">
            <div className="join-meta-card">
              <p className="meta-label">Wallet</p>
              <p className="meta-value nums">{address ? short(address) : 'warming up...'}</p>
            </div>
            <div className="join-meta-card">
              <p className="meta-label">Balance</p>
              <p className="meta-value">
                <strong className="nums">{fmtMon(balance)}</strong> MON
              </p>
            </div>
          </div>
        </div>
      </section>

      {!hasContract && (
        <p className="system-error text-sm">
          <code>VITE_CLUTCH_ADDRESS</code> is not set. Deploy the contract and add it to{' '}
          <code>.env</code>.
        </p>
      )}

      {step === 'error' && (
        <div className="space-y-3">
          <p className="system-error text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="ghost-button w-full font-semibold"
          >
            Try again
          </button>
        </div>
      )}

      <button
        onClick={() => navigate('/m')}
        disabled={step !== 'ready'}
        className="cta-button cta-button--yes w-full text-lg"
      >
        {step === 'ready' ? 'Enter Clutch' : 'Setting up your wallet...'}
      </button>

      <p className="join-disclaimer">
        Burner wallet, testnet MON, play money. Nothing here has real value.
      </p>
    </main>
  )
}
