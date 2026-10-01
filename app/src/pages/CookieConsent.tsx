import '../styles/cookie-consent.css'

export default function CookieConsent() {
  return (
    <main className="cookie-page">
      <section
        className="cookie-dialog"
        role="dialog"
        aria-labelledby="cookie-title"
        aria-describedby="cookie-copy"
      >
        <div className="cookie-copy">
          <h1 id="cookie-title">Allow cookies from TikTok on this browser?</h1>
          <p id="cookie-copy">
            TikTok uses cookies and similar technologies to provide, improve, protect and analyze
            our services. Essential cookies are necessary for our site to work as intended. By
            selecting &quot;Allow all&quot;, you allow us to use optional cookies for additional
            purposes, such as measuring the effectiveness and relevance of ads, including
            personalized ads on TikTok.com, depending on your settings. Optional cookies also
            help us do other things, such as better measure the performance of our advertising
            campaigns off TikTok.com. Learn more about how we use cookies and manage your
            choices in our <a href="https://www.tiktok.com/legal/page/global/cookie-policy/en" target="_blank" rel="noreferrer">Cookies Policy</a>.
          </p>
        </div>

        <div className="cookie-actions" aria-label="Cookie choices">
          <button type="button" className="cookie-button cookie-button--secondary">
            Decline optional cookies
          </button>
          <button type="button" className="cookie-button cookie-button--primary">
            Allow all
          </button>
        </div>

        <button type="button" className="cookie-ghost" disabled aria-disabled="true">
          Open on TikTok
        </button>
      </section>
    </main>
  )
}
