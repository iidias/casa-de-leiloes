import { createContext, type ReactNode, useContext, useState } from "react"

type AuctionState = {
  total: number
  committed: number
  available: number
  commitBid: (value: number) => void
  deposit: (value: number) => void
}

const AuctionContext = createContext<AuctionState | null>(null)

export function AuctionProvider({ children }: { children: ReactNode }) {
  const [total, setTotal] = useState(1890000)
  const [committed, setCommitted] = useState(640000)

  return (
    <AuctionContext.Provider
      value={{
        total,
        committed,
        available: total - committed,
        commitBid: (value) => setCommitted((current) => current + value),
        deposit: (value) => setTotal((current) => current + value),
      }}
    >
      {children}
    </AuctionContext.Provider>
  )
}

export function useAuction() {
  const context = useContext(AuctionContext)
  if (!context)
    throw new Error("useAuction must be used inside AuctionProvider")
  return context
}
