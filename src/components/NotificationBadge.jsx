import { useEffect, useState } from 'react'
import { FiTarget } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { getUserNotifications } from '../lib/wishlistMatching'

export default function NotificationBadge() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return

    const checkNotifications = async () => {
      try {
        const notifications = await getUserNotifications(user.uid)
        const unread = notifications.filter((n) => !n.read).length
        setUnreadCount(unread)
      } catch (error) {
        console.error('Error checking notifications:', error)
      }
    }

    checkNotifications()
    // Verificar notificaciones cada 30 segundos
    const interval = setInterval(checkNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  if (!user || unreadCount === 0) return null

  return (
    <div className="relative">
      <button className="text-brass hover:text-brassHigh transition-colors">
        <FiTarget size={24} />
      </button>
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-bidRed text-ink text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  )
}
