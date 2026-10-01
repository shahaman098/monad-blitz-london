import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Admin from './pages/Admin'
import CookieConsent from './pages/CookieConsent'
import Join from './pages/Join'
import Trade from './pages/Trade'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Trade />} />
        <Route path="/frontend" element={<Trade />} />
        <Route path="/frontend/:id" element={<Trade />} />
        <Route path="/cookie-consent" element={<CookieConsent />} />
        <Route path="/join" element={<Join />} />
        <Route path="/m" element={<Trade />} />
        <Route path="/m/:id" element={<Trade />} />
        <Route path="/screen" element={<Trade />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Trade />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
