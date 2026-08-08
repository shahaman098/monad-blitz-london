import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/join.css'
import { ClutchMark } from '../components/icons'
import { publicClient } from '../lib/chain'
import { getBurner, requestFunding } from '../lib/wallet'

/**
 * Splash shown while a burner wallet is created and funded.
 *
 * Deliberately just the logo: this is the very first thing the room sees after
 * scanning, it is on screen for a second or two, and a checklist of internal
 * provisioning steps is noise to them. Only a failure is worth interrupting for.
 */
export default function Join() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        const account = getBurner()
        const existing = await publicClient.getBalance({ address: account.address })
        if (!alive) return

        if (existing === 0n) {
          const result = await requestFunding(account.address)
          if (!alive) return
          if (!result.ok) throw new Error(result.error ?? 'Funding failed')

          // Wait for the drip to land. Monad blocks are ~400ms, so this is quick.
          for (let i = 0; i < 40; i++) {
            const next = await publicClient.getBalance({ address: account.address })
            if (!alive) return
            if (next > 0n) break
            await new Promise((r) => setTimeout(r, 400))
          }
        }
        if (alive) navigate('/m', { replace: true })
      } catch (e) {
        if (alive) setError((e as Error).message)
      }
    }

    void run()
    return () => {
      alive = false
    }
  }, [navigate])

  return (
    <main className="join">
      <div className="join-mark">
        <ClutchMark size={72} />
        <strong>Clutch</strong>
      </div>

      {error ? (
        <div className="join-error">
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : (
        <span className="join-bar" aria-label="Loading" />
      )}
    </main>
  )
}
