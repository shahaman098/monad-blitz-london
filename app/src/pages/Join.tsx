import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/join.css'
import { ClutchMark } from '../components/icons'
import { publicClient } from '../lib/chain'
import { getBurner, requestFunding } from '../lib/wallet'

const MINIMUM_SPLASH_MS = 1800

export default function Join() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const provision = async () => {
      const splashStartedAt = Date.now()

      const finish = async () => {
        const remaining = MINIMUM_SPLASH_MS - (Date.now() - splashStartedAt)
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
        if (alive) navigate('/m', { replace: true })
      }

      try {
        const account = getBurner()
        const existing = await publicClient.getBalance({ address: account.address })
        if (!alive) return

        if (existing === 0n) {
          const result = await requestFunding(account.address)
          if (!alive) return
          if (!result.ok) throw new Error(result.error ?? 'Funding failed')

          for (let attempt = 0; attempt < 40; attempt++) {
            const balance = await publicClient.getBalance({ address: account.address })
            if (!alive) return
            if (balance > 0n) {
              await finish()
              return
            }
            await new Promise((resolve) => setTimeout(resolve, 400))
          }
          throw new Error('Funding did not land in time. Tap below to retry.')
        }

        await finish()
      } catch (cause) {
        if (alive) setError((cause as Error).message)
      }
    }

    void provision()
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
        <>
          <p className="join-copy">Creating your testnet wallet and adding MON</p>
          <span className="join-bar" aria-label="Funding burner wallet" />
        </>
      )}
    </main>
  )
}
