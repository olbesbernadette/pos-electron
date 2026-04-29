"use client"

import { useState } from "react"
import { X, CaretDown, CaretRight, MagnifyingGlass, Bell, User, SignOut } from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/contexts/sidebar-context"
import { useAuth } from "@/contexts/auth-context"

const topNavItems = [
  { name: "SALES", href: "/sales", adminOnly: false },
  { name: "EXPENSES", href: "/expenses", adminOnly: false },
  { name: "BODEGA", href: "/bodega", adminOnly: false },
  { name: "CHECKS", href: "/checks", adminOnly: false },
  { name: "CREDIT", href: "/credit", adminOnly: false },
  { name: "ADMIN", href: "/admin", adminOnly: true },
]

const branchItems = [
  { name: "Hardware", slug: "hardware" },
  { name: "Pawa Gas", slug: "pawa-gas" },
  { name: "Matnog Gas", slug: "matnog-gas" },
  { name: "Gotis Hotel", slug: "gotis-hotel" },
  { name: "Rental", slug: "rental" },
  { name: "Boarders", slug: "boarders" },
]

const bodegaItems = [
  { name: "Pawa", slug: "pawa" },
  { name: "Zone 2", slug: "zone-2" },
]

interface SidebarItem {
  name: string
  slug: string
  subItems?: { name: string; slug: string }[]
}

const adminItems: SidebarItem[] = [
  { 
    name: "Daily", 
    slug: "daily",
    subItems: [
      { name: "Sales", slug: "daily-sales" },
      { name: "Expenses", slug: "daily-expenses" },
    ]
  },
  { name: "Sales", slug: "sales" },
  { name: "Expenses", slug: "expenses" },
  { name: "Deposits", slug: "deposits" },
  { name: "Checks", slug: "checks" },
  { name: "Customers", slug: "customers" },
  { name: "Rentals", slug: "rentals" },
  { name: "Boarders", slug: "boarders" },
  { 
    name: "Databases", 
    slug: "databases",
    subItems: [
      { name: "Branches", slug: "databases-branches" },
      { name: "Products", slug: "databases-products" },
    ]
  },
]

const sectionLabels: Record<string, string> = {
  "/sales": "Sales",
  "/expenses": "Expenses",
  "/bodega": "Bodega",
  "/checks": "Checks",
  "/credit": "Credit",
  "/admin": "Admin",
}

interface SidebarProps {
  basePath?: string
}

export function Sidebar({ basePath = "/sales" }: SidebarProps) {
  const sectionLabel = sectionLabels[basePath] || "Branches"
  const { isOpen, close } = useSidebar()
  const pathname = usePathname()
  const { user, isAdmin: userIsAdmin, signOut } = useAuth()
  
  // Use admin items for admin section, bodega items for bodega section, branch items for everything else
  const sidebarItems = basePath === "/admin" ? adminItems : basePath === "/bodega" ? bodegaItems : branchItems
  
  // Track which collapsible items are expanded
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => {
    // Initialize with items that have an active subitem expanded
    const initial: Record<string, boolean> = {}
    if (basePath === "/admin") {
      adminItems.forEach(item => {
        if (item.subItems?.some(sub => pathname === `${basePath}/${sub.slug}`)) {
          initial[item.slug] = true
        }
      })
    }
    return initial
  })
  
  const toggleExpanded = (slug: string) => {
    setExpandedItems(prev => ({ ...prev, [slug]: !prev[slug] }))
  }

  // Desktop: conditionally renders. Mobile: always rendered so CSS can animate in/out.
  const menuItems = (
    <>
      {sidebarItems.map((item) => {
        const href = `${basePath}/${item.slug}`
        const isActive = pathname === href
        const hasSubItems = 'subItems' in item && item.subItems && item.subItems.length > 0
        const isSubItemActive = hasSubItems && item.subItems?.some(sub => pathname === `${basePath}/${sub.slug}`)
        const isExpanded = expandedItems[item.slug] || isSubItemActive

        return (
          <div key={item.slug}>
            {hasSubItems ? (
              <button
                onClick={() => toggleExpanded(item.slug)}
                className={`flex items-center justify-between w-full text-left px-6 py-4 md:py-3 text-base md:text-sm font-mono tracking-wide transition-colors border-l-2 ${
                  isActive || isSubItemActive
                    ? "bg-gray-50 text-black border-black"
                    : "text-gray-600 border-transparent hover:bg-gray-50 hover:text-black hover:border-black"
                }`}
              >
                <span>{item.name}</span>
                {isExpanded ? (
                  <CaretDown className="w-4 h-4 md:w-3 md:h-3" />
                ) : (
                  <CaretRight className="w-4 h-4 md:w-3 md:h-3" />
                )}
              </button>
            ) : (
              <Link
                href={href}
                onClick={close}
                className={`block w-full text-left px-6 py-4 md:py-3 text-base md:text-sm font-mono tracking-wide transition-colors border-l-2 ${
                  isActive
                    ? "bg-gray-50 text-black border-black"
                    : "text-gray-600 border-transparent hover:bg-gray-50 hover:text-black hover:border-black"
                }`}
              >
                {item.name}
              </Link>
            )}
            {hasSubItems && isExpanded && item.subItems?.map((subItem) => {
              const subHref = `${basePath}/${subItem.slug}`
              const isSubActive = pathname === subHref
              return (
                <Link
                  key={subItem.slug}
                  href={subHref}
                  onClick={close}
                  className={`block w-full text-left pl-10 pr-6 py-3 md:py-2 text-sm md:text-xs font-mono tracking-wide transition-colors border-l-2 ${
                    isSubActive
                      ? "bg-gray-50 text-black border-black"
                      : "text-gray-500 border-transparent hover:bg-gray-50 hover:text-black hover:border-black"
                  }`}
                >
                  {subItem.name}
                </Link>
              )
            })}
          </div>
        )
      })}
    </>
  )

  return (
    <>
      {/* ── MOBILE: full-screen overlay ── */}
      <div
        className={`
          fixed inset-0 z-50 flex flex-col bg-white
          transition-transform duration-300 ease-in-out
          md:hidden
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Mobile overlay header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">{sectionLabel}</p>
          <button
            onClick={close}
            className="p-2 -mr-2 text-gray-400 hover:text-black transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <nav className="flex-1 overflow-y-auto">
          {/* Search */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center bg-gray-50 px-4 py-3 border border-gray-200">
              <MagnifyingGlass className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
              <input
                type="text"
                placeholder="SEARCH"
                className="bg-transparent text-sm outline-none placeholder-gray-400 w-full font-mono tracking-wider"
              />
            </div>
          </div>

          {/* Top-level nav links */}
          <div className="border-b border-gray-100 py-2">
            <p className="px-6 pt-2 pb-1 text-xs text-gray-400 font-mono tracking-widest uppercase">Navigate</p>
            {topNavItems
              .filter(item => !item.adminOnly || userIsAdmin)
              .map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={close}
                  className={`flex items-center px-6 py-4 text-base font-mono tracking-wide transition-colors border-l-2 ${
                    pathname.startsWith(item.href)
                      ? "bg-gray-50 text-black border-black"
                      : "text-gray-600 border-transparent hover:bg-gray-50 hover:text-black hover:border-black"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
          </div>

          {/* Section-specific sidebar items */}
          <div className="py-2">
            <p className="px-6 pt-2 pb-1 text-xs text-gray-400 font-mono tracking-widest uppercase">{sectionLabel}</p>
            {menuItems}
          </div>
        </nav>

        {/* User profile footer — pinned to bottom */}
        <div className="border-t border-gray-100 shrink-0">
          {/* Notifications */}
          <button className="flex items-center gap-3 w-full px-6 py-4 text-sm font-mono text-gray-600 hover:bg-gray-50 hover:text-black transition-colors">
            <Bell className="w-5 h-5" />
            <span className="tracking-wide">Notifications</span>
          </button>

          {/* User info */}
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-gray-100 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-gray-400 tracking-wider uppercase mb-0.5">Signed in as</p>
                <p className="text-sm font-mono font-medium truncate">{user?.email}</p>
              </div>
              {userIsAdmin && (
                <span className="px-2 py-0.5 text-xs font-mono tracking-wider bg-black text-white shrink-0">
                  ADMIN
                </span>
              )}
            </div>
            <button
              onClick={() => {
                close()
                signOut().then(() => window.location.href = '/auth/login')
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-mono tracking-widest text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-black transition-colors"
            >
              <SignOut className="w-4 h-4" />
              SIGN OUT
            </button>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: always visible, isOpen only controls mobile overlay ── */}
      <aside className="hidden md:block relative z-40 w-52 shrink-0 border-r border-gray-200 min-h-full bg-white">
        <nav className="py-4">
          <div className="flex items-center justify-between px-6 py-2 mb-1">
            <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">{sectionLabel}</p>
          </div>
          {menuItems}
        </nav>
      </aside>
    </>
  )
}
