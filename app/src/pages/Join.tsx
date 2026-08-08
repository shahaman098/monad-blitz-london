import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtMon, hasContract, publicClient, short } from '../lib/chain'
import { getBurner, requestFunding } from '../lib/wallet'

type Step = 'wallet' | 'funding' | 'ready' | 'error'

const StepRow = ({ done, active, label }: { done: boolean; active: boolean; label: string }) => (
  <div className="flex items-center gap-3">
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
        done
          ? 'border-yes bg-yes text-ink'
          : active
            ? 'border-yes text-yes'
            : 'border-edge text-dim'
      }`}
    >
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
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header>
        <h1 className="text-5xl font-black tracking-tighter">CLUTCH</h1>
        <p className="mt-2 text-balance text-lg text-dim">
          In-play prediction markets that reprice between the plays. Live on Monad testnet.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-edge bg-panel p-5">
        <StepRow done={step !== 'wallet'} active={step === 'wallet'} label="Creating your wallet" />
        <StepRow
          done={step === 'ready'}
          active={step === 'funding'}
          label="Dropping in testnet MON"
        />
        <StepRow done={step === 'ready'} active={false} label="Ready to trade" />
      </section>

      <section className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-dim">Wallet</span>
          <span className="nums">{address ? short(address) : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dim">Balance</span>
          <span className="nums">{fmtMon(balance)} MON</span>
        </div>
      </section>

      {!hasContract && (
        <p className="rounded-xl border border-no/40 bg-no/10 p-4 text-sm text-no">
          <code>VITE_CLUTCH_ADDRESS</code> is not set. Deploy the contract and add it to{' '}
          <code>.env</code>.
        </p>
      )}

      {step === 'error' && (
        <div className="space-y-3 rounded-xl border border-no/40 bg-no/10 p-4 text-sm">
          <p className="text-no">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-lg border border-edge py-2 font-semibold"
          >
            Try again
          </button>
        </div>
      )}

      <button
        onClick={() => navigate('/m')}
        disabled={step !== 'ready'}
        className="w-full rounded-xl bg-yes py-4 text-lg font-bold text-ink transition disabled:opacity-30"
      >
        {step === 'ready' ? 'Start trading' : 'Setting you up…'}
      </button>

      <p className="text-center text-xs text-dim">
        Burner wallet, testnet MON, play money. Nothing here has real value.
      </p>
    </main>
  )
}
