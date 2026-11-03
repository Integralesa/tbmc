import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  subscribeToAuction,
  subscribeToUserAuctions,
  subscribeToUserBids,
} from '../lib/auctions'
import Countdown from '../components/Countdown'

function StatusBadge({ status }) {
  if (status === 'active') {
    return <span className="text-xs text-bidGreen">Activa</span>
  }
  return <span className="text-xs text-muted">Cerrada</span>
}

function MisSubastas({ userId }) {
  const [auctions, setAuctions] = useState(null)

  useEffect(() => {
    const unsub = subscribeToUserAuctions(userId, setAuctions)
    return unsub
  }, [userId])

  if (auctions === null) return <p className="text-muted">Cargando…</p>
  if (auctions.length === 0) {
    return (
      <div className="border border-panelLine border-dashed p-8 text-center">
        <p className="text-parchment mb-1">Todavía no publicaste ninguna carta.</p>
        <Link to="/publicar" className="text-brass text-sm hover:underline">
          Publicar mi primera carta
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-panelLine">
      {auctions.map((a) => (
        <li key={a.id}>
          <Link
            to={`/subasta/${a.id}`}
            className="flex items-center gap-4 py-4 hover:bg-panel/60 transition-colors px-2"
          >
            <div className="w-14 h-20 bg-panel border border-panelLine shrink-0 overflow-hidden">
              {a.images?.[0] && (
                <img src={a.images[0]} alt={a.title} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-parchment font-serif text-lg truncate">{a.title}</p>
              <p className="text-xs text-muted">{a.bidCount || 0} pujas</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-brass font-medium">
                ${a.currentPrice?.toLocaleString('es-AR')}
              </p>
              <div className="text-xs mt-0.5">
                <StatusBadge status={a.status} />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function MisPujas({ userId }) {
  const [bids, setBids] = useState(null)
  const [auctionsById, setAuctionsById] = useState({})

  useEffect(() => {
    const unsub = subscribeToUserBids(userId, setBids)
    return unsub
  }, [userId])

  // ids únicos de subastas en las que participé, en orden de puja más reciente
  const auctionIds = useMemo(() => {
    if (!bids) return []
    const seen = new Set()
    const ids = []
    for (const b of bids) {
      if (!seen.has(b.auctionId)) {
        seen.add(b.auctionId)
        ids.push(b.auctionId)
      }
    }
    return ids
  }, [bids])

  // un listener en tiempo real por cada subasta en la que pujé,
  // así vemos al instante si me superaron o si gané.
  useEffect(() => {
    const unsubs = auctionIds.map((id) =>
      subscribeToAuction(id, (auction) => {
        setAuctionsById((prev) => ({ ...prev, [id]: auction }))
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [auctionIds])

  if (bids === null) return <p className="text-muted">Cargando…</p>
  if (auctionIds.length === 0) {
    return (
      <div className="border border-panelLine border-dashed p-8 text-center">
        <p className="text-parchment mb-1">Todavía no pujaste en ninguna subasta.</p>
        <Link to="/" className="text-brass text-sm hover:underline">
          Ver lotes activos
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-panelLine">
      {auctionIds.map((id) => {
        const a = auctionsById[id]
        if (!a) return null
        const winning = a.currentBidderId === userId
        const ended = a.status !== 'active'

        return (
          <li key={id}>
            <Link
              to={`/subasta/${id}`}
              className="flex items-center gap-4 py-4 hover:bg-panel/60 transition-colors px-2"
            >
              <div className="w-14 h-20 bg-panel border border-panelLine shrink-0 overflow-hidden">
                {a.images?.[0] && (
                  <img src={a.images[0]} alt={a.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-parchment font-serif text-lg truncate">{a.title}</p>
                <p className="text-xs">
                  {ended ? (
                    winning ? (
                      <span className="text-brass">Ganaste esta subasta</span>
                    ) : (
                      <span className="text-muted">No ganaste</span>
                    )
                  ) : winning ? (
                    <span className="text-bidGreen">Vas ganando</span>
                  ) : (
                    <span className="text-bidRed">Te superaron</span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-brass font-medium">
                  ${a.currentPrice?.toLocaleString('es-AR')}
                </p>
                {!ended && (
                  <div className="text-xs mt-0.5">
                    <Countdown endsAt={a.endsAt} />
                  </div>
                )}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const [tab, setTab] = useState('subastas')

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-parchment">Iniciá sesión con Google para ver tu perfil.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        {user.photoURL && (
          <img src={user.photoURL} alt={user.displayName} className="w-12 h-12 rounded-full" />
        )}
        <div>
          <h1 className="font-serif text-2xl text-parchment">{user.displayName}</h1>
          <p className="text-muted text-sm">{user.email}</p>
        </div>
      </div>

      <div className="flex gap-6 border-b border-panelLine mb-6">
        <button
          onClick={() => setTab('subastas')}
          className={`pb-3 text-sm ${
            tab === 'subastas'
              ? 'text-brass border-b-2 border-brass'
              : 'text-muted hover:text-parchment'
          }`}
        >
          Mis subastas
        </button>
        <button
          onClick={() => setTab('pujas')}
          className={`pb-3 text-sm ${
            tab === 'pujas'
              ? 'text-brass border-b-2 border-brass'
              : 'text-muted hover:text-parchment'
          }`}
        >
          Mis pujas
        </button>
      </div>

      {tab === 'subastas' ? (
        <MisSubastas userId={user.uid} />
      ) : (
        <MisPujas userId={user.uid} />
      )}
    </div>
  )
}
