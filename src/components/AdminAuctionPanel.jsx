import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { closeAuctionByAdmin } from '../lib/admin'

export default function AdminAuctionPanel({ auction }) {
  const [sellerProfile, setSellerProfile] = useState(undefined)
  const [bidderProfile, setBidderProfile] = useState(undefined)
  const [closing, setClosing] = useState(false)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    getDoc(doc(db, 'users', auction.sellerId))
      .then((snap) => setSellerProfile(snap.exists() ? snap.data() : null))
      .catch(() => setSellerProfile(null))
  }, [auction.sellerId])

  useEffect(() => {
    if (!auction.currentBidderId) {
      setBidderProfile(null)
      return
    }
    getDoc(doc(db, 'users', auction.currentBidderId))
      .then((snap) => setBidderProfile(snap.exists() ? snap.data() : null))
      .catch(() => setBidderProfile(null))
  }, [auction.currentBidderId])

  async function handleClose() {
    setActing(true)
    setError('')
    setMessage('')
    try {
      await closeAuctionByAdmin(auction.id, reason)
      setMessage('Subasta cerrada.')
      setClosing(false)
    } catch (err) {
      setError(err.message || 'No se pudo cerrar la subasta.')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="border border-bidRed/50 bg-bidRed/5 p-4 mb-6">
      <p className="text-[10px] uppercase tracking-wide text-bidRed mb-3">Solo vos ves esto — panel de admin</p>

      <div className="space-y-1 text-sm mb-3">
        <p className="text-muted">
          Vendedor: <span className="text-parchment">{sellerProfile?.email || 'cargando…'}</span>
          {sellerProfile?.phone && <span className="text-muted"> · WhatsApp: {sellerProfile.phone}</span>}
        </p>
        {auction.currentBidderId && (
          <p className="text-muted">
            Va ganando: <span className="text-parchment">{bidderProfile?.email || 'cargando…'}</span>
            {bidderProfile?.phone && <span className="text-muted"> · WhatsApp: {bidderProfile.phone}</span>}
          </p>
        )}
      </div>

      {auction.status === 'active' &&
        (closing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo del cierre"
              className="flex-1 bg-ink border border-panelLine px-2 py-1.5 text-xs text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
            />
            <button
              onClick={handleClose}
              disabled={acting}
              className="px-3 py-1.5 bg-bidRed text-ink text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Confirmar cierre
            </button>
            <button
              onClick={() => setClosing(false)}
              className="px-3 py-1.5 border border-panelLine text-muted text-xs hover:text-parchment transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setClosing(true)}
            className="px-3 py-1.5 border border-bidRed text-bidRed text-xs font-medium hover:bg-bidRed/10 transition-colors"
          >
            Cerrar esta subasta
          </button>
        ))}

      {error && <p className="text-bidRed text-xs mt-2">{error}</p>}
      {message && <p className="text-bidGreen text-xs mt-2">{message}</p>}
    </div>
  )
}
