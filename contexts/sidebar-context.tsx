"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface SidebarContextType {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

// Provide default values so it works even before mounting
const SidebarContext = createContext<SidebarContextType>({
  isOpen: true,
  toggle: () => {},
  open: () => {},
  close: () => {},
})

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Default to true on larger screens (will be corrected on mount)
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    // Check initial screen size
    const isLargeScreen = window.innerWidth >= 768
    setIsOpen(isLargeScreen)

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true)
      } else {
        setIsOpen(false)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const toggle = () => setIsOpen((prev) => !prev)
  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
