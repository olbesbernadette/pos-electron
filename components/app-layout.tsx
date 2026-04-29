"use client"

import { GoogleCardboardLogo, MagnifyingGlass, SignOut, User, CaretDown, List, Bell } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useSidebar } from "@/contexts/sidebar-context"
import { usePrinter } from "@/contexts/printer-context"

const navItems = [
  { name: "SALES", href: "/sales", adminOnly: false },
  { name: "EXPENSES", href: "/expenses", adminOnly: false },
  { name: "BODEGA", href: "/bodega", adminOnly: false },
  { name: "CHECKS", href: "/checks", adminOnly: false },
  { name: "CREDIT", href: "/credit", adminOnly: false },
  { name: "ADMIN", href: "/admin", adminOnly: true },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isAdmin: userIsAdmin, signOut } = useAuth()
  const { toggle: toggleSidebar } = useSidebar()
  const { connectedPrinter } = usePrinter()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isPrinterOpen, setIsPrinterOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const printerRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
      if (printerRef.current && !printerRef.current.contains(event.target as Node)) {
        setIsPrinterOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-white text-black font-mono">
      <header className="px-8 py-6 border-b border-gray-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="p-2 text-gray-600 hover:text-black transition-colors md:hidden"
              aria-label="Toggle sidebar"
            >
              <List className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-2">
              <GoogleCardboardLogo className="h-8 w-8 text-black" weight="bold" />
              <span className="text-lg font-bold tracking-widest uppercase">JBJ TRADING</span>
            </Link>
          </div>

          {/* Desktop nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center space-x-12">
            {navItems
              .filter((item) => !item.adminOnly || userIsAdmin)
              .map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-xs font-medium tracking-widest uppercase transition-colors ${
                    pathname === item.href
                      ? "text-black border-b-2 border-black pb-1"
                      : "text-gray-400 hover:text-black"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
          </nav>

          {/* Desktop actions — hidden on mobile */}
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center bg-gray-50 rounded-none px-4 py-2 border border-gray-200">
              <MagnifyingGlass className="w-4 h-4 text-gray-400 mr-3" />
              <input
                type="text"
                placeholder="SEARCH"
                className="bg-transparent text-xs outline-none placeholder-gray-400 w-24 font-mono tracking-wider"
              />
            </div>

            {/* Notification Icon with Printer Status Dropdown */}
            <div className="relative" ref={printerRef}>
              <button
                onClick={() => setIsPrinterOpen(!isPrinterOpen)}
                className="relative text-gray-600 hover:text-black transition-colors"
                aria-label="Printer status"
              >
                <Bell className="w-5 h-5" />
              </button>

              {isPrinterOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 shadow-lg z-50">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className={`inline-block w-3 h-3 rounded-full mt-1 flex-shrink-0 ${connectedPrinter ? "bg-green-500" : "bg-red-500"}`} />
                      <div>
                        <p className="text-xs text-gray-400 font-mono tracking-wider uppercase mb-1">Printer Status</p>
                        <p className="text-sm font-medium">
                          {connectedPrinter ? `${connectedPrinter}` : "No printer detected"}
                        </p>
                        {!connectedPrinter && (
                          <p className="text-xs text-gray-500 mt-2">Please check your thermal printer connection</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
              >
                <User className="w-5 h-5" />
                <CaretDown className={`w-3 h-3 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 shadow-lg z-50">
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-xs text-gray-400 font-mono tracking-wider uppercase mb-1">Signed in as</p>
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    {userIsAdmin && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs font-mono tracking-wider bg-black text-white">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false)
                        signOut().then(() => window.location.href = '/auth/login')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono tracking-wider text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
                    >
                      <SignOut className="w-4 h-4" />
                      SIGN OUT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-gray-200 px-8 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center items-center gap-2 mb-6">
            <GoogleCardboardLogo className="h-6 w-6 text-gray-400" weight="bold" />
            <span className="text-sm font-bold tracking-widest uppercase text-gray-400">JBJ TRADING</span>
          </div>
          <p className="text-gray-400 text-xs font-mono tracking-widest uppercase">
            © 2026 JBJ TRADING, INC. ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>
    </div>
  )
}
