"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

interface ShiftContextType {
  currentShiftId: number | null
  hasOpenShift: boolean
  isLoading: boolean
  openShift: (userEmail: string, userId: string) => Promise<boolean>
  closeShift: (userEmail: string, userId: string) => Promise<boolean>
  refreshShift: () => Promise<void>
  showCloseShiftDialog: boolean
  setShowCloseShiftDialog: (show: boolean) => void
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined)

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [currentShiftId, setCurrentShiftId] = useState<number | null>(null)
  const [hasOpenShift, setHasOpenShift] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showCloseShiftDialog, setShowCloseShiftDialog] = useState(false)

  const checkOpenShift = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("shifts")
      .select("id, start_time")
      .eq("status", 1)
      .order("start_time", { ascending: false })
      .limit(1)
      .single()

    if (data && !error) {
      setHasOpenShift(true)
      setCurrentShiftId(data.id)
    } else {
      setHasOpenShift(false)
      setCurrentShiftId(null)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    checkOpenShift()
  }, [checkOpenShift])

  // Realtime subscription to detect shift changes from other users
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel('shifts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
        },
        (payload) => {
          // When any shift changes, refresh to get the current open shift
          checkOpenShift()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [checkOpenShift])

  const openShift = useCallback(async (userEmail: string, userId: string): Promise<boolean> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("shifts")
      .insert({
        status: 1,
        opened_by: userEmail,
        opened_by_user: userId,
        start_time: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (data && !error) {
      setHasOpenShift(true)
      setCurrentShiftId(data.id)
      return true
    }
    return false
  }, [])

  const closeShift = useCallback(async (userEmail: string, userId: string): Promise<boolean> => {
    if (!currentShiftId) return false

    const supabase = createClient()
    const { error } = await supabase
      .from("shifts")
      .update({
        status: 2,
        end_time: new Date().toISOString(),
        closed_by: userEmail,
        closed_by_user: userId,
      })
      .eq("id", currentShiftId)

    if (!error) {
      setHasOpenShift(false)
      setCurrentShiftId(null)
      return true
    }
    return false
  }, [currentShiftId])

  const refreshShift = useCallback(async () => {
    await checkOpenShift()
  }, [checkOpenShift])

  const value = useMemo(() => ({
    currentShiftId,
    hasOpenShift,
    isLoading,
    openShift,
    closeShift,
    refreshShift,
    showCloseShiftDialog,
    setShowCloseShiftDialog,
  }), [currentShiftId, hasOpenShift, isLoading, openShift, closeShift, refreshShift, showCloseShiftDialog])

  return (
    <ShiftContext.Provider value={value}>
      {children}
    </ShiftContext.Provider>
  )
}

export function useShift() {
  const context = useContext(ShiftContext)
  if (context === undefined) {
    throw new Error("useShift must be used within a ShiftProvider")
  }
  return context
}
