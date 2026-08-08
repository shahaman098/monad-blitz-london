import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import Join from './pages/Join'
import Trade from './pages/Trade'
import Screen from './pages/Screen'
import Admin from './pages/Admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Join />} />
        <Route path="/m" element={<Trade />} />
        <Route path="/m/:id" element={<Trade />} />
        <Route path="/screen" element={<Screen />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
