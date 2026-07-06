"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { TrendUp, Receipt, Bank, Clock, CreditCard, Gear, Play, Stop, Warehouse } from "@phosphor-icons/react"
import { useAuth } from "@/contexts/auth-context"
import { useShift } from "@/contexts/shift-context"
import { CloseShiftDialog } from "@/components/close-shift-dialog"

interface MenuItem {
  id: string
  name: string
  description: string
  icon: string
  href: string
}

const menuItems: MenuItem[] = [
  {
    id: "1",
    name: "Sales",
    description: "Add sales records",
    icon: "sales",
    href: "/sales",
  },
  {
    id: "2",
    name: "Expenses",
    description: "Add expense records",
    icon: "expenses",
    href: "/expenses",
  },
  {
    id: "3",
    name: "Bodega",
    description: "Manage inventory and stock",
    icon: "bodega",
    href: "/bodega",
  },
  {
    id: "4",
    name: "Attendance",
    description: "Track attendance records",
    icon: "attendance",
    href: "/attendance",
  },
  {
    id: "5",
    name: "Credit",
    description: "Add credit records",
    icon: "credit",
    href: "/credit",
  },
  {
    id: "6",
    name: "Admin",
    description: "System settings and user management",
    icon: "admin",
    href: "/admin",
  },
]

export default function Dashboard() {
  const { user } = useAuth()
  const { hasOpenShift, isLoading, openShift, refreshShift, currentShiftId, showCloseShiftDialog, setShowCloseShiftDialog } = useShift()
  const [greeting, setGreeting] = useState("Good morning!")
  const [currentDateTime, setCurrentDateTime] = useState("")

  const handleShiftToggle = async () => {
    const userEmail = user?.email || "unknown"
    const userId = user?.id || ""

    if (hasOpenShift) {
      // Open the confirmation dialog instead of directly closing
      setShowCloseShiftDialog(true)
    } else {
      await openShift(userEmail, userId)
    }
  }

  const handleShiftClosed = () => {
    // Refresh shift status after successful close
    refreshShift()
  }

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const hour = now.getHours()
      
      if (hour >= 12 && hour < 18) {
        setGreeting("Good afternoon!")
      } else if (hour >= 18) {
        setGreeting("Good evening!")
      } else {
        setGreeting("Good morning!")
      }

      const dateStr = now.toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      const timeStr = now.toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).replace(" ", "")
      
      setCurrentDateTime(`${dateStr}\n${timeStr}`)
    }

    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
    <CloseShiftDialog
      isOpen={showCloseShiftDialog}
      onClose={() => setShowCloseShiftDialog(false)}
      shiftId={currentShiftId}
      onShiftClosed={handleShiftClosed}
      userEmail={user?.email || "unknown"}
      userId={user?.id || ""}
    />
    <section className="px-8 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-16">
          <div>
            <h2 className="text-xl font-medium tracking-wide">Hi, {greeting.toLowerCase()}</h2>
            <p className="text-xs text-gray-500 font-mono tracking-wider mt-1 whitespace-pre-line">{currentDateTime}</p>
          </div>
          <Button
            variant="outline"
            onClick={handleShiftToggle}
            disabled={isLoading}
            className={`text-xs font-medium tracking-widest uppercase px-6 transition-all duration-300 hover:scale-105 flex items-center gap-2 ${
              hasOpenShift
                ? "border-red-600 text-red-600 hover:bg-red-600 hover:text-white bg-transparent"
                : "border-black text-black hover:bg-black hover:text-white bg-transparent"
            }`}
          >
            {isLoading ? (
              <span>Loading...</span>
            ) : hasOpenShift ? (
              <>
                <Stop className="w-4 h-4" weight="fill" />
                Close Shift
              </>
            ) : (
              <>
                <Play className="w-4 h-4" weight="fill" />
                New Shift
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item) => {
            const IconComponent = {
              sales: TrendUp,
              expenses: Receipt,
              bodega: Warehouse,
              attendance: Clock,
              credit: CreditCard,
              admin: Gear,
            }[item.icon]

            return (
              <Link
                key={item.id}
                href={item.href}
                className="group cursor-pointer transition-all duration-200 border border-gray-200 p-8 hover:border-black hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-50 group-hover:bg-black transition-colors duration-200">
                    {IconComponent && (
                      <IconComponent className="w-6 h-6 text-black group-hover:text-white transition-colors duration-200" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium tracking-wide mb-2">{item.name}</h3>
                    <p className="text-xs text-gray-500 font-mono tracking-wider">{item.description}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
    </>
  )
}
