import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isUserBanned, subscribeToOwnProfile } from '../lib/users'
import { SUSURRO_EMAIL } from '../lib/roles'

export default function BanBanner() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    const unsub = subscribeToOwnProfile(user.uid, setProfile)
    return unsub
  }, [user])

  if (!user || !isUserBanned(profile)) return null

  const until = profile.bannedUntil?.toDate ? profile.bannedUntil.toDate() : null

  return (
    <div className="bg-bidRed/15 border-b border-bidRed/40 text-center py-2 px-4">
      <p className="text-sm text-bidRed">
        Tu cuenta está suspendida{until ? ` hasta el ${until.toLocaleDateString('es-AR')}` : ' de forma permanente'}.
        No podés publicar ni pujar mientras dure. Si creés que es un error, escribinos a{' '}
        <a
          href={`mailto:${SUSURRO_EMAIL}?subject=${encodeURIComponent('Quiero apelar una suspensión')}`}
          className="underline"
        >
          {SUSURRO_EMAIL}
        </a>
        .
      </p>
    </div>
  )
}
