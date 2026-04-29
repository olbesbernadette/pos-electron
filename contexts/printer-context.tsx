"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface PrinterContextType {
  connectedPrinter: string | null
  isPrinterReady: boolean
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined)

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [connectedPrinter, setConnectedPrinter] = useState<string | null>(null)
  const [isPrinterReady, setIsPrinterReady] = useState(false)

  // Auto-detect printer on mount (Electron only)
  useEffect(() => {
    const detectPrinter = async () => {
      try {
        const isElectron = (window as any).electronAPI?.isElectron
        if (!isElectron) {
          setIsPrinterReady(true)
          return
        }

        const result = await (window as any).electronAPI.getConnectedPrinter()
        
        if (result.success && result.printer) {
          setConnectedPrinter(result.printer)
          console.log("[v0] Printer detected:", result.printer)
        } else if (!result.printer) {
          console.log("[v0] No printer detected, attempting auto-detection...")
          const autoDetectResult = await (window as any).electronAPI.autoDetectPrinter()
          if (autoDetectResult.success && autoDetectResult.printer) {
            setConnectedPrinter(autoDetectResult.printer)
            console.log("[v0] Printer auto-detected:", autoDetectResult.printer)
          } else {
            setConnectedPrinter(null)
            console.log("[v0] Printer auto-detection failed")
          }
        }

        setIsPrinterReady(true)
      } catch (error) {
        console.error("[v0] Printer detection error:", error)
        setConnectedPrinter(null)
        setIsPrinterReady(true)
      }
    }

    detectPrinter()
  }, [])

  return (
    <PrinterContext.Provider value={{ connectedPrinter, isPrinterReady }}>
      {children}
    </PrinterContext.Provider>
  )
}

export function usePrinter() {
  const context = useContext(PrinterContext)
  if (!context) {
    throw new Error("usePrinter must be used within PrinterProvider")
  }
  return context
}
