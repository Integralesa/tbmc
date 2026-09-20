import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeToUnreadNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/notifications'
import { playCoinSound } from '../lib/sound'

/**
 * Campanita de avisos en el Navbar. A diferencia del viejo AuctionAlerts
 * (que solo detectaba cosas mientras tenías el sitio abierto en el momento
 * exacto), estos avisos los crea la Cloud Function notifyOnAuctionChange
 * en el servidor (ver functions/index.js), así que te quedan esperando
 * aunque hayas estado desconectado: te superaron la puja, cancelaron una
 * subasta en la que pujaste, terminó tu subasta, o ganaste una.
 */
export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (!user) {
      setNotifications([])
      return
    }
    const unsub = subscribeToUnreadNotifications(user.uid, (list) => {
      if (list.length > prevCountRef.current) playCoinSound()
      prevCountRef.current = list.length
      setNotifications(list)
    })
    return unsub
  }, [user])

  if (!user) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative text-parchment/80 hover:text-brass transition-colors"
        aria-label="Avisos"
      >
        🔔
        {notifications.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-bidRed text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-panel border border-panelLine shadow-lg z-50 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted p-4">No tenés avisos nuevos.</p>
            ) : (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-panelLine">
                  <span className="text-xs text-muted">Avisos</span>
                  <button
                    type="button"
                    onClick={() => markAllNotificationsRead(notifications)}
                    className="text-xs text-brass hover:underline"
                  >
                    Marcar todas como leídas
                  </button>
                </div>
                {notifications.map((n) => (
                  <div key={n.id} className="px-3 py-2.5 border-b border-panelLine last:border-b-0 text-sm">
                    <p className="text-parchment/90 mb-1.5">{n.message}</p>
                    <div className="flex items-center gap-4">
                      <Link
                        to={`/subasta/${n.auctionId}`}
                        onClick={() => {
                          markNotificationRead(n.id)
                          setOpen(false)
                        }}
                        className="text-brass hover:underline text-xs"
                      >
                        Ver subasta →
                      </Link>
                      <button
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="text-muted hover:text-parchment text-xs"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
