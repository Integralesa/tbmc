import { useEffect, useMemo, useState } from 'react'
import { subscribeToAuction, subscribeToUserBids } from '../lib/auctions'

/**
 * Todas las subastas en las que el usuario pujó, con un listener en tiempo
 * real por cada una (así se ve al instante si lo superaron o si ganó).
 * Compartido por "Mis pujas", "Subastas ganadas" y el aviso de "te están
 * ganando la subasta" (ver OutbidWatcher).
 */
export function useMyBidAuctions(userId) {
  const [bids, setBids] = useState(null)
  const [auctionsById, setAuctionsById] = useState({})

  useEffect(() => {
    if (!userId) return
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

  useEffect(() => {
    const unsubs = auctionIds.map((id) =>
      subscribeToAuction(id, (auction) => {
        setAuctionsById((prev) => ({ ...prev, [id]: auction }))
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [auctionIds])

  return { bids, auctionIds, auctionsById, loading: bids === null }
}
