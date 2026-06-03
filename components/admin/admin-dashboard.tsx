"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useShift } from "@/contexts/shift-context"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CaretDown } from "@phosphor-icons/react"

interface Transaction {
  id: number
  branch_id: number
  payment_type: number
  amount: number
  transaction_type: number
  shift_id: number
  created_at: string
}

interface SalesExpensesRow {
  date: string
  total_sales: number
  total_expenses: number
}

interface DepositOverviewRow {
  date: string
  deposit_type: number
  total_amount: number
}

const branchNames: Record<number, string> = {
  1: "Hardware",
  2: "Pawa Gas",
  3: "Matnog Gas",
  4: "Gotis Hotel",
  5: "Rental",
  6: "Boarders",
}

const expenseTypeNames: Record<number, string> = {
  5: "Payroll",
  6: "Deposit",
  7: "Repairs",
  8: "Utilities",
  9: "Port Fees",
  10: "Others",
}

const branchBarColors: Record<number, { fill: string; stroke: string }> = {
  1: { fill: "#1e40af", stroke: "#1e3a8a" },  // blue-800 / blue-900
  2: { fill: "#2563eb", stroke: "#1d4ed8" },  // blue-600 / blue-700
  3: { fill: "#3b82f6", stroke: "#2563eb" },  // blue-500 / blue-600
  4: { fill: "#60a5fa", stroke: "#3b82f6" },  // blue-400 / blue-500
  5: { fill: "#93c5fd", stroke: "#60a5fa" },  // blue-300 / blue-400
  6: { fill: "#bfdbfe", stroke: "#93c5fd" },  // blue-200 / blue-300
}

const expenseBarColors: Record<string, { fill: string; stroke: string }> = {
  Payroll:     { fill: "#1e40af", stroke: "#1e3a8a" },  // blue-800
  Deposit:     { fill: "#1d4ed8", stroke: "#1e40af" },  // blue-700
  Repairs:     { fill: "#3b82f6", stroke: "#2563eb" },  // blue-500
  Utilities:   { fill: "#60a5fa", stroke: "#3b82f6" },  // blue-400
  "Port Fees": { fill: "#93c5fd", stroke: "#60a5fa" },  // blue-300
  Others:      { fill: "#bfdbfe", stroke: "#93c5fd" },  // blue-200
}

const formatCurrency = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

const formatMonth = (ym: string) => {
  const [y, m] = ym.split("-")
  return new Date(+y, +m - 1, 1).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", year: "numeric" })
}

const overviewConfig: ChartConfig = {
  sales:    { label: "Sales",    color: "#1d4ed8" },  // blue-700
  expenses: { label: "Expenses", color: "#93c5fd" },  // blue-300
}

const depositsConfig: ChartConfig = {
  cash:  { label: "Cash",  color: "#1e40af" },  // blue-800
  check: { label: "Check", color: "#3b82f6" },  // blue-500
  gcash: { label: "GCash", color: "#93c5fd" },  // blue-300
}

function localDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + 1)
  return localDateString(d)
}

type DateRangeOption = "today" | "mtd" | "last_month" | "year" | "custom"

function buildDayRange(from: string, to: string) {
  const result: { date: string; dateLabel: string }[] = []
  const cur = new Date(from + "T00:00:00")
  const end = new Date(to + "T00:00:00")
  while (cur <= end) {
    result.push({
      date: localDateString(cur),
      dateLabel: cur.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" }),
    })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function buildMonthRange(from: string, to: string) {
  const result: { date: string; dateLabel: string }[] = []
  const end = new Date(to + "T00:00:00")
  const cur = new Date(new Date(from + "T00:00:00").getFullYear(), new Date(from + "T00:00:00").getMonth(), 1)
  while (cur <= end) {
    result.push({
      date: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
      dateLabel: cur.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" }),
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return result
}

function computeRange(opt: DateRangeOption, customFrom: string, customTo: string) {
  const today = localDateString(new Date())
  const now = new Date()
  switch (opt) {
    case "today":
      return { from: today, to: today }
    case "mtd":
      return { from: localDateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
    case "last_month": {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const t = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: localDateString(f), to: localDateString(t) }
    }
    case "year":
      return { from: `${now.getFullYear()}-01-01`, to: today }
    case "custom":
      return { from: customFrom, to: customTo }
  }
}

const branches = [
  { id: 1, name: "Hardware" },
  { id: 2, name: "Pawa Gas" },
  { id: 3, name: "Matnog Gas" },
  { id: 4, name: "Gotis Hotel" },
  { id: 5, name: "Rental" },
  { id: 6, name: "Boarders" },
]

export function AdminDashboard() {
  const { currentShiftId, hasOpenShift } = useShift()

  const [selectedBranch, setSelectedBranch] = useState<number | null>(null)
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>("mtd")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const [dailyTransactions, setDailyTransactions] = useState<Transaction[]>([])
  const [dailyLoading, setDailyLoading] = useState(true)

  const [salesExpensesOverview, setSalesExpensesOverview] = useState<SalesExpensesRow[]>([])
  const [depositsOverview, setDepositsOverview] = useState<DepositOverviewRow[]>([])
  const [overviewLoading, setOverviewLoading] = useState(true)

  const [rangeSalesByBranch, setRangeSalesByBranch] = useState<{ branch_id: number; total_amount: number }[]>([])
  const [rangeExpensesByType, setRangeExpensesByType] = useState<{ payment_type: number; total_amount: number }[]>([])

  const [undepositedChecksTotal, setUndepositedChecksTotal] = useState(0)
  const [undepositedChecksCount, setUndepositedChecksCount] = useState(0)
  const [rangeCogs, setRangeCogs] = useState(0)
  const [cogsRawData, setCogsRawData] = useState<any[]>([])
  const [shiftTotalsRawData, setShiftTotalsRawData] = useState<any[]>([])

  // Fetch current shift transactions
  useEffect(() => {
    const fetchDaily = async () => {
      if (!currentShiftId) {
        setDailyTransactions([])
        setDailyLoading(false)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from("shift_transactions")
        .select("id, branch_id, payment_type, amount, transaction_type, shift_id, created_at")
        .eq("shift_id", currentShiftId)
      setDailyTransactions(data || [])
      setDailyLoading(false)
    }
    fetchDaily()
  }, [currentShiftId])

  // Fetch overview via RPCs + shift_totals for branch/type breakdown
  const fetchOverview = useCallback(async () => {
    const range = computeRange(dateRangeOption, customFrom, customTo)
    if (!range.from || !range.to) return
    setOverviewLoading(true)
    const supabase = createClient()

    const shiftTotalsQ = selectedBranch !== null
      ? supabase.from("shift_totals").select("branch_id, payment_type, transaction_type, total_amount, created_at")
          .gte("created_at", range.from)
          .lt("created_at", nextDay(range.to))
          .eq("branch_id", selectedBranch)
      : supabase.from("shift_totals").select("branch_id, payment_type, transaction_type, total_amount, created_at")
          .gte("created_at", range.from)
          .lt("created_at", nextDay(range.to))

    const checksQ = selectedBranch !== null
      ? supabase.from("shift_transactions").select("amount").eq("payment_type", 3).eq("transaction_type", 1).neq("status", 2).eq("branch_id", selectedBranch)
      : supabase.from("shift_transactions").select("amount").eq("payment_type", 3).eq("transaction_type", 1).neq("status", 2)

    const cogsQ = supabase
      .from("stock_in")
      .select("created_at, stock_in_items(total)")
      .gte("created_at", range.from)
      .lt("created_at", nextDay(range.to))

    const [
      { data: salesExpenses, error: salesErr },
      { data: deposits, error: depositsErr },
      { data: shiftTotalsRaw, error: shiftTotalsErr },
      { data: checksRaw, error: checksErr },
      { data: cogsRaw, error: cogsErr },
    ] = await Promise.all([
      supabase.rpc("get_sales_overview", { p_from: range.from, p_to: range.to, p_branch_id: selectedBranch }),
      supabase.rpc("get_deposits_overview", { p_from: range.from, p_to: range.to, p_branch_id: selectedBranch }),
      shiftTotalsQ,
      checksQ,
      cogsQ,
    ])

    if (salesErr) console.error("get_sales_overview:", salesErr.message)
    if (depositsErr) console.error("get_deposits_overview:", depositsErr.message)
    if (shiftTotalsErr) console.error("shift_totals:", shiftTotalsErr.message)
    if (checksErr) console.error("undeposited checks:", checksErr.message)
    if (cogsErr) console.error("cogs:", cogsErr.message)

    setSalesExpensesOverview(salesExpenses ?? [])
    setDepositsOverview(deposits ?? [])

    const raw = shiftTotalsRaw ?? []
    const salesMap: Record<number, number> = {}
    raw.filter((r) => r.transaction_type === 1).forEach((r) => {
      salesMap[r.branch_id] = (salesMap[r.branch_id] || 0) + Number(r.total_amount)
    })
    setRangeSalesByBranch(Object.entries(salesMap).map(([id, total_amount]) => ({ branch_id: +id, total_amount })))

    const expMap: Record<number, number> = {}
    raw.filter((r) => r.transaction_type === 2).forEach((r) => {
      expMap[r.payment_type] = (expMap[r.payment_type] || 0) + Number(r.total_amount)
    })
    setRangeExpensesByType(Object.entries(expMap).map(([type, total_amount]) => ({ payment_type: +type, total_amount })))

    const checks = checksRaw ?? []
    setUndepositedChecksTotal(checks.reduce((s, r) => s + Number(r.amount), 0))
    setUndepositedChecksCount(checks.length)

    const totalCogs = (cogsRaw ?? []).reduce((sum: number, row: any) =>
      sum + (row.stock_in_items || []).reduce((s: number, i: any) => s + Number(i.total ?? 0), 0), 0
    )
    setRangeCogs(totalCogs)
    setCogsRawData(cogsRaw ?? [])
    setShiftTotalsRawData(shiftTotalsRaw ?? [])

    setOverviewLoading(false)
  }, [selectedBranch, dateRangeOption, customFrom, customTo])

  useEffect(() => { fetchOverview() }, [fetchOverview])

  // Realtime: current shift transactions
  useEffect(() => {
    if (!currentShiftId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`admin-dashboard-txns-${currentShiftId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_transactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const tx = payload.new as Transaction
          if (tx.shift_id === currentShiftId) {
            setDailyTransactions((prev) => [tx, ...prev])
          }
        } else if (payload.eventType === "DELETE") {
          const tx = payload.old as Transaction
          setDailyTransactions((prev) => prev.filter((t) => t.id !== tx.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentShiftId])

  // Realtime: refetch RPCs when a deposit, shift close, or check deposit happens
  useEffect(() => {
    const supabase = createClient()
    const depositsChannel = supabase
      .channel("admin-dashboard-deposits")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "deposits" }, () => {
        fetchOverview()
      })
      .subscribe()
    const totalsChannel = supabase
      .channel("admin-dashboard-shift-totals")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shift_totals" }, () => {
        fetchOverview()
      })
      .subscribe()
    const checksChannel = supabase
      .channel("admin-dashboard-check-deposits")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shift_transactions" }, () => {
        fetchOverview()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(depositsChannel)
      supabase.removeChannel(totalsChannel)
      supabase.removeChannel(checksChannel)
    }
  }, [fetchOverview])

  const filteredDaily = useMemo(() =>
    selectedBranch === null
      ? dailyTransactions
      : dailyTransactions.filter((t) => t.branch_id === selectedBranch),
    [dailyTransactions, selectedBranch]
  )

  const dailySales = useMemo(() => filteredDaily.filter((t) => t.transaction_type === 1), [filteredDaily])
  const dailyExpenses = useMemo(() => filteredDaily.filter((t) => t.transaction_type === 2), [filteredDaily])

  const totalDailySales = useMemo(() => dailySales.reduce((s, t) => s + t.amount, 0), [dailySales])
  const totalDailyExpenses = useMemo(() => dailyExpenses.reduce((s, t) => s + t.amount, 0), [dailyExpenses])

  const activeRange = useMemo(
    () => computeRange(dateRangeOption, customFrom, customTo),
    [dateRangeOption, customFrom, customTo]
  )

  const includesOpenShift = useMemo(() => {
    if (!hasOpenShift || !activeRange.from || !activeRange.to) return false
    const today = localDateString(new Date())
    return today >= activeRange.from && today <= activeRange.to
  }, [hasOpenShift, activeRange])

  // Sales by branch — range-aware
  const salesByBranch = useMemo(() => {
    const map: Record<number, number> = {}
    if (dateRangeOption === "today") {
      dailySales.forEach((t) => { map[t.branch_id] = (map[t.branch_id] || 0) + t.amount })
    } else {
      rangeSalesByBranch.forEach((r) => { map[r.branch_id] = (map[r.branch_id] || 0) + r.total_amount })
      if (includesOpenShift) {
        dailySales.forEach((t) => { map[t.branch_id] = (map[t.branch_id] || 0) + t.amount })
      }
    }
    return Object.entries(map)
      .map(([id, amount]) => ({
        branch: branchNames[+id] || `Branch ${id}`,
        amount,
        fill: branchBarColors[+id]?.fill || "rgba(243,244,246,0.5)",
        stroke: branchBarColors[+id]?.stroke || "#d1d5db",
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [dateRangeOption, rangeSalesByBranch, dailySales, includesOpenShift])

  // Expenses by type — range-aware
  const expensesByType = useMemo(() => {
    const map: Record<number, number> = {}
    if (dateRangeOption === "today") {
      dailyExpenses.forEach((t) => { map[t.payment_type] = (map[t.payment_type] || 0) + t.amount })
    } else {
      rangeExpensesByType.forEach((r) => { map[r.payment_type] = (map[r.payment_type] || 0) + r.total_amount })
      if (includesOpenShift) {
        dailyExpenses.forEach((t) => { map[t.payment_type] = (map[t.payment_type] || 0) + t.amount })
      }
    }
    return Object.entries(map)
      .map(([type, amount]) => {
        const label = expenseTypeNames[+type] || `Type ${type}`
        const colors = expenseBarColors[label] || { fill: "rgba(243,244,246,0.5)", stroke: "#d1d5db" }
        return { type: label, amount, fill: colors.fill, stroke: colors.stroke }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [dateRangeOption, rangeExpensesByType, dailyExpenses, includesOpenShift])

  const totalRangeSales = useMemo(() => {
    if (dateRangeOption === "today") return totalDailySales
    let total = rangeSalesByBranch.reduce((s, r) => s + r.total_amount, 0)
    if (includesOpenShift) total += totalDailySales
    return total
  }, [dateRangeOption, rangeSalesByBranch, totalDailySales, includesOpenShift])

  const totalRangeExpenses = useMemo(() => {
    if (dateRangeOption === "today") return totalDailyExpenses
    let total = rangeExpensesByType.reduce((s, r) => s + r.total_amount, 0)
    if (includesOpenShift) total += totalDailyExpenses
    return total
  }, [dateRangeOption, rangeExpensesByType, totalDailyExpenses, includesOpenShift])

  const monthlyPL = useMemo(() => {
    if (dateRangeOption === "today") return []
    const monthMap: Record<string, { month: string; sales: number; cogs: number; expenses: Record<string, number> }> = {}

    salesExpensesOverview.forEach(row => {
      const month = row.date.substring(0, 7)
      if (!monthMap[month]) monthMap[month] = { month, sales: 0, cogs: 0, expenses: {} }
      monthMap[month].sales += Number(row.total_sales)
    })

    cogsRawData.forEach((row: any) => {
      const month = (row.created_at as string).substring(0, 7)
      if (!monthMap[month]) monthMap[month] = { month, sales: 0, cogs: 0, expenses: {} }
      monthMap[month].cogs += (row.stock_in_items || []).reduce((s: number, i: any) => s + Number(i.total ?? 0), 0)
    })

    shiftTotalsRawData
      .filter((r: any) => r.transaction_type === 2)
      .forEach((r: any) => {
        const month = (r.created_at as string).substring(0, 7)
        if (!monthMap[month]) monthMap[month] = { month, sales: 0, cogs: 0, expenses: {} }
        const typeName = expenseTypeNames[r.payment_type] || `Type ${r.payment_type}`
        monthMap[month].expenses[typeName] = (monthMap[month].expenses[typeName] || 0) + Number(r.total_amount)
      })

    return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month))
  }, [dateRangeOption, salesExpensesOverview, cogsRawData, shiftTotalsRawData])

  const groupBy = useMemo((): "day" | "month" => {
    if (!activeRange.from || !activeRange.to) return "day"
    const diff =
      new Date(activeRange.to + "T00:00:00").getTime() -
      new Date(activeRange.from + "T00:00:00").getTime()
    return Math.ceil(diff / 86400000) + 1 > 31 ? "month" : "day"
  }, [activeRange])

  const rangeLabel = useMemo(() => {
    switch (dateRangeOption) {
      case "today": return "Today"
      case "mtd": return "Month to Date"
      case "last_month": return "Last Month"
      case "year": return `Year ${new Date().getFullYear()}`
      case "custom":
        if (!customFrom || !customTo) return "Custom Range"
        return `${new Date(customFrom + "T00:00:00").toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" })} – ${new Date(customTo + "T00:00:00").toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })}`
    }
  }, [dateRangeOption, customFrom, customTo])

  // Sales & expenses overview
  const overviewData = useMemo(() => {
    if (!activeRange.from || !activeRange.to) return []
    const days = (groupBy === "month"
      ? buildMonthRange(activeRange.from, activeRange.to)
      : buildDayRange(activeRange.from, activeRange.to)
    ).map((d) => ({ ...d, sales: 0, expenses: 0 }))

    salesExpensesOverview.forEach((item) => {
      const key = groupBy === "month" ? item.date.slice(0, 7) : item.date
      const entry = days.find((d) => d.date === key)
      if (entry) {
        entry.sales += Number(item.total_sales)
        entry.expenses += Number(item.total_expenses)
      }
    })

    if (hasOpenShift) {
      const today = localDateString(new Date())
      const todayKey = groupBy === "month" ? today.slice(0, 7) : today
      const todayEntry = days.find((d) => d.date === todayKey)
      if (todayEntry) {
        todayEntry.sales += totalDailySales
        todayEntry.expenses += totalDailyExpenses
      }
    }

    return days
  }, [salesExpensesOverview, activeRange, groupBy, hasOpenShift, totalDailySales, totalDailyExpenses])

  // Deposits overview
  const depositsData = useMemo(() => {
    if (!activeRange.from || !activeRange.to) return []
    const days = (groupBy === "month"
      ? buildMonthRange(activeRange.from, activeRange.to)
      : buildDayRange(activeRange.from, activeRange.to)
    ).map((d) => ({ ...d, cash: 0, check: 0, gcash: 0 }))

    depositsOverview.forEach((item) => {
      const key = groupBy === "month" ? item.date.slice(0, 7) : item.date
      const entry = days.find((d) => d.date === key)
      if (entry) {
        const amt = Number(item.total_amount)
        const dtype = Number(item.deposit_type)
        if (dtype === 1) entry.cash += amt
        else if (dtype === 2) entry.check += amt
        else if (dtype === 3) entry.gcash += amt
      }
    })

    return days
  }, [depositsOverview, activeRange, groupBy])

  const totalDeposits = useMemo(
    () => depositsData.reduce((s, d) => s + d.cash + d.check + d.gcash, 0),
    [depositsData]
  )

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Status row */}
      <div className="flex items-center gap-3">
        {hasOpenShift ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono tracking-wider border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono tracking-wider border border-gray-200 bg-gray-50 text-gray-500 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            No Open Shift
          </span>
        )}
        <span className="hidden sm:inline text-xs font-mono text-gray-400 tracking-wider">
          {new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila",
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
        <span className="sm:hidden text-xs font-mono text-gray-400 tracking-wider">
          {new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        {/* Branch filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider shrink-0 w-16">Branch:</span>
          <button
            onClick={() => setSelectedBranch(null)}
            className={`px-3 py-1 text-xs font-mono border transition-colors ${
              selectedBranch === null
                ? "border-black bg-black text-white"
                : "border-gray-200 text-gray-500 hover:border-gray-400"
            }`}
          >
            All
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(selectedBranch === b.id ? null : b.id)}
              className={`px-3 py-1 text-xs font-mono border transition-colors ${
                selectedBranch === b.id
                  ? "border-black bg-black text-white"
                  : "border-gray-200 text-gray-500 hover:border-gray-400"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-2 flex-wrap md:justify-end">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider shrink-0 w-16">Period:</span>
          {(["today", "mtd", "last_month", "year", "custom"] as DateRangeOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setDateRangeOption(opt)}
              className={`px-3 py-1 text-xs font-mono border transition-colors ${
                dateRangeOption === opt
                  ? "border-black bg-black text-white"
                  : "border-gray-200 text-gray-500 hover:border-gray-400"
              }`}
            >
              {opt === "today" ? "Today"
                : opt === "mtd" ? "MTD"
                : opt === "last_month" ? "Last Month"
                : opt === "year" ? `Year ${new Date().getFullYear()}`
                : "Custom"}
            </button>
          ))}

          {/* Custom date pickers */}
          {dateRangeOption === "custom" && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-7 px-3 text-xs font-mono border border-gray-200 flex items-center gap-1.5 hover:border-gray-400 transition-colors">
                    {customFrom
                      ? new Date(customFrom + "T00:00:00").toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })
                      : "From"}
                    <CaretDown className="w-3 h-3 text-gray-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customFrom ? new Date(customFrom + "T00:00:00") : undefined}
                    onSelect={(date) => date && setCustomFrom(localDateString(date))}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-gray-400">–</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-7 px-3 text-xs font-mono border border-gray-200 flex items-center gap-1.5 hover:border-gray-400 transition-colors">
                    {customTo
                      ? new Date(customTo + "T00:00:00").toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" })
                      : "To"}
                    <CaretDown className="w-3 h-3 text-gray-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customTo ? new Date(customTo + "T00:00:00") : undefined}
                    onSelect={(date) => date && setCustomTo(localDateString(date))}
                    disabled={(date) => customFrom ? date < new Date(customFrom + "T00:00:00") : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          label={`${rangeLabel} Sales`}
          value={formatCurrency(totalRangeSales)}
          sub={dateRangeOption === "today" ? `${dailySales.length} transactions` : `closed shifts${includesOpenShift ? " + shift" : ""}`}
          loading={dateRangeOption === "today" ? dailyLoading : overviewLoading}
          color="navy"
        />
        <StatCard
          label={`${rangeLabel} Expenses`}
          value={formatCurrency(totalRangeExpenses)}
          sub={dateRangeOption === "today" ? `${dailyExpenses.length} entries` : `closed shifts${includesOpenShift ? " + shift" : ""}`}
          loading={dateRangeOption === "today" ? dailyLoading : overviewLoading}
          color="blue"
        />
        <StatCard
          label="Net (Sales − Exp)"
          value={formatCurrency(totalRangeSales - totalRangeExpenses)}
          sub={dateRangeOption === "today" ? (hasOpenShift ? "shift open" : "no open shift") : rangeLabel}
          loading={dateRangeOption === "today" ? dailyLoading : overviewLoading}
          color={totalRangeSales - totalRangeExpenses >= 0 ? "green" : "red"}
        />
        <StatCard
          label={`${rangeLabel} Deposits`}
          value={formatCurrency(totalDeposits)}
          sub="cash + check + gcash"
          loading={overviewLoading}
          color="blue"
        />
        <StatCard
          label="Undeposited Checks"
          value={formatCurrency(undepositedChecksTotal)}
          sub={`${undepositedChecksCount} check${undepositedChecksCount !== 1 ? "s" : ""} outstanding`}
          loading={overviewLoading}
          color="gray"
        />
        <StatCard
          label={`${rangeLabel} COGS`}
          value={formatCurrency(rangeCogs)}
          sub="stock-in purchases"
          loading={overviewLoading}
          color="navy"
        />
      </div>

      {/* Sales & expenses by branch/type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard
          title={`Sales by Branch — ${rangeLabel}`}
          subtitle={dateRangeOption === "today" ? "Current shift — updates in realtime" : `Closed shifts${includesOpenShift ? " + current shift" : ""}`}
          loading={dateRangeOption === "today" ? dailyLoading : overviewLoading}
          empty={salesByBranch.length === 0}
          emptyMessage={dateRangeOption === "today" ? (currentShiftId ? "No sales in current shift" : "No open shift") : "No sales data for this period"}
          chartClassName=""
        >
          <BarList items={salesByBranch.map(e => ({ label: e.branch, amount: e.amount, fill: e.fill }))} />
        </ChartCard>

        <ChartCard
          title={`Expenses by Type — ${rangeLabel}`}
          subtitle={dateRangeOption === "today" ? "Current shift — updates in realtime" : `Closed shifts${includesOpenShift ? " + current shift" : ""}`}
          loading={dateRangeOption === "today" ? dailyLoading : overviewLoading}
          empty={expensesByType.length === 0}
          emptyMessage={dateRangeOption === "today" ? (currentShiftId ? "No expenses in current shift" : "No open shift") : "No expense data for this period"}
          chartClassName=""
        >
          <BarList items={expensesByType.map(e => ({ label: e.type, amount: e.amount, fill: e.fill }))} />
        </ChartCard>
      </div>

      {/* 7-day overview charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard
          title={`Sales & Expenses — ${rangeLabel}`}
          subtitle={groupBy === "month" ? "Grouped by month" : "Grouped by day"}
          loading={overviewLoading}
          empty={false}
        >
          <ChartContainer config={overviewConfig} className="h-full w-full">
            <AreaChart data={overviewData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fontFamily: "sans-serif" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fontFamily: "sans-serif" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => formatCurrency(Number(v))}
                    indicator="dot"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#1d4ed8"
                strokeWidth={2}
                fill="url(#gradSales)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#93c5fd"
                strokeWidth={2}
                fill="url(#gradExpenses)"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={`Deposits — ${rangeLabel}`}
          subtitle="Cash · Check · GCash"
          loading={overviewLoading}
          empty={false}
        >
          <ChartContainer config={depositsConfig} className="h-full w-full">
            <BarChart data={depositsData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fontFamily: "sans-serif" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fontFamily: "sans-serif" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => formatCurrency(Number(v))}
                    indicator="dot"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="cash" fill="#1e40af" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="check" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="gcash" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* P&L Statement */}
      {(() => {
        const grossProfit = totalRangeSales - rangeCogs
        const netProfit = grossProfit - totalRangeExpenses
        const isLoading = overviewLoading || (dateRangeOption === "today" && dailyLoading)
        const pct = (v: number, base: number) => base > 0 ? `${((Math.abs(v) / base) * 100).toFixed(1)}%` : ""
        const allExpenseTypes = [...new Set([
          ...expensesByType.map(e => e.type),
          ...monthlyPL.flatMap(m => Object.keys(m.expenses)),
        ])]
        return (
          <div className="border border-gray-200 p-4 sm:p-6">
            <div className="mb-5">
              <h3 className="text-sm font-sans font-medium tracking-wide uppercase text-gray-700">P&L Statement</h3>
              <p className="text-xs font-sans text-gray-400 mt-0.5">{rangeLabel}</p>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {["w-1/2", "w-2/3", "w-1/2", "w-3/4", "w-1/3", "w-2/3", "w-1/2", "w-3/4"].map((w, i) => (
                  <div key={i} className={`h-4 bg-gray-100 animate-pulse rounded ${w}`} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="font-mono text-sm border-collapse w-full min-w-[480px]">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-8 font-normal text-[10px] text-gray-400 uppercase tracking-widest w-44" />
                      {monthlyPL.map(m => (
                        <th key={m.month} className="text-right py-2 px-4 font-normal text-[10px] text-gray-400 uppercase tracking-widest whitespace-nowrap">
                          {formatMonth(m.month)}
                        </th>
                      ))}
                      <th className="text-right py-2 pl-4 font-medium text-[10px] text-gray-500 uppercase tracking-widest whitespace-nowrap">
                        {monthlyPL.length > 1 ? "Total" : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>

                    {/* Total Sales */}
                    <tr className="border-t border-gray-100">
                      <td className="py-2 pr-8 text-gray-600">Total Sales</td>
                      {monthlyPL.map(m => (
                        <td key={m.month} className="py-2 px-4 text-right text-gray-800">
                          <div className="flex items-baseline justify-end gap-2">
                            <span className="tabular-nums">{formatCurrency(m.sales)}</span>
                            <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">100%</span>
                          </div>
                        </td>
                      ))}
                      <td className="py-2 pl-4 text-right font-medium text-gray-800">
                        <div className="flex items-baseline justify-end gap-2">
                          <span className="tabular-nums">{formatCurrency(totalRangeSales)}</span>
                          <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">100%</span>
                        </div>
                      </td>
                    </tr>

                    {/* COGS */}
                    <tr className="border-t border-gray-100">
                      <td className="py-2 pr-8 text-gray-600">COGS</td>
                      {monthlyPL.map(m => (
                        <td key={m.month} className="py-2 px-4 text-right text-blue-300">
                          <div className="flex items-baseline justify-end gap-2">
                            <span className="tabular-nums">{m.cogs > 0 ? `(${formatCurrency(m.cogs)})` : "—"}</span>
                            <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{pct(m.cogs, m.sales)}</span>
                          </div>
                        </td>
                      ))}
                      <td className="py-2 pl-4 text-right font-medium text-blue-300">
                        <div className="flex items-baseline justify-end gap-2">
                          <span className="tabular-nums">{rangeCogs > 0 ? `(${formatCurrency(rangeCogs)})` : "—"}</span>
                          <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{pct(rangeCogs, totalRangeSales)}</span>
                        </div>
                      </td>
                    </tr>

                    {/* Gross Profit */}
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td className="py-2 pr-8 font-medium text-gray-700">Gross Profit</td>
                      {monthlyPL.map(m => {
                        const gp = m.sales - m.cogs
                        return (
                          <td key={m.month} className={`py-2 px-4 text-right font-medium ${gp >= 0 ? "text-blue-800" : "text-red-600"}`}>
                            <div className="flex items-baseline justify-end gap-2">
                              <span className="tabular-nums">{formatCurrency(gp)}</span>
                              <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{pct(gp, m.sales)}</span>
                            </div>
                          </td>
                        )
                      })}
                      <td className={`py-2 pl-4 text-right font-medium ${grossProfit >= 0 ? "text-blue-800" : "text-red-600"}`}>
                        <div className="flex items-baseline justify-end gap-2">
                          <span className="tabular-nums">{formatCurrency(grossProfit)}</span>
                          <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{pct(grossProfit, totalRangeSales)}</span>
                        </div>
                      </td>
                    </tr>

                    {/* Expense rows */}
                    {allExpenseTypes.length === 0 ? (
                      <tr className="border-t border-gray-100">
                        <td colSpan={monthlyPL.length + 2} className="py-2 pr-8 pl-4 text-xs text-gray-400">No expenses</td>
                      </tr>
                    ) : allExpenseTypes.map(typeName => {
                      const total = expensesByType.find(e => e.type === typeName)?.amount ?? 0
                      return (
                        <tr key={typeName} className="border-t border-gray-100">
                          <td className="py-1.5 pr-8 pl-4 text-xs text-gray-500">{typeName}</td>
                          {monthlyPL.map(m => (
                            <td key={m.month} className="py-1.5 px-4 text-right text-xs text-gray-600">
                              <div className="flex items-baseline justify-end gap-2">
                                <span className="tabular-nums">{m.expenses[typeName] ? `(${formatCurrency(m.expenses[typeName])})` : "—"}</span>
                                <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{m.expenses[typeName] ? pct(m.expenses[typeName], m.sales) : ""}</span>
                              </div>
                            </td>
                          ))}
                          <td className="py-1.5 pl-4 text-right text-xs text-gray-600">
                            <div className="flex items-baseline justify-end gap-2">
                              <span className="tabular-nums">{total > 0 ? `(${formatCurrency(total)})` : "—"}</span>
                              <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{total > 0 ? pct(total, totalRangeSales) : ""}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {/* Total Expenses */}
                    <tr className="border-t border-gray-200">
                      <td className="py-2 pr-8 text-gray-600">Total Expenses</td>
                      {monthlyPL.map(m => {
                        const exp = Object.values(m.expenses).reduce((s, v) => s + v, 0)
                        return (
                          <td key={m.month} className="py-2 px-4 text-right text-blue-300">
                            <div className="flex items-baseline justify-end gap-2">
                              <span className="tabular-nums">{exp > 0 ? `(${formatCurrency(exp)})` : "—"}</span>
                              <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{pct(exp, m.sales)}</span>
                            </div>
                          </td>
                        )
                      })}
                      <td className="py-2 pl-4 text-right font-medium text-blue-300">
                        <div className="flex items-baseline justify-end gap-2">
                          <span className="tabular-nums">{totalRangeExpenses > 0 ? `(${formatCurrency(totalRangeExpenses)})` : "—"}</span>
                          <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{pct(totalRangeExpenses, totalRangeSales)}</span>
                        </div>
                      </td>
                    </tr>

                    {/* Net Profit */}
                    <tr className="border-t-2 border-gray-800">
                      <td className="py-3 pr-8 font-semibold text-gray-900">Net Profit</td>
                      {monthlyPL.map(m => {
                        const exp = Object.values(m.expenses).reduce((s, v) => s + v, 0)
                        const np = m.sales - m.cogs - exp
                        return (
                          <td key={m.month} className={`py-3 px-4 text-right font-semibold ${np >= 0 ? "text-blue-800" : "text-red-600"}`}>
                            <div className="flex items-baseline justify-end gap-2">
                              <span className="tabular-nums">{formatCurrency(np)}</span>
                              <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{pct(np, m.sales)}</span>
                            </div>
                          </td>
                        )
                      })}
                      <td className={`py-3 pl-4 text-right font-semibold ${netProfit >= 0 ? "text-blue-800" : "text-red-600"}`}>
                        <div className="flex items-baseline justify-end gap-2">
                          <span className="tabular-nums">{formatCurrency(netProfit)}</span>
                          <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">{pct(netProfit, totalRangeSales)}</span>
                        </div>
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function BarList({ items }: { items: { label: string; amount: number; fill: string }[] }) {
  const max = Math.max(...items.map((i) => i.amount), 1)
  const total = items.reduce((s, i) => s + i.amount, 0)
  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0
        const barWidth = (item.amount / max) * 100
        return (
          <div key={idx}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-sans text-gray-600">
                {item.label}{" "}
                <span className="text-gray-400">{pct}%</span>
              </span>
              <span className="text-xs font-sans text-gray-500 tabular-nums">{formatCurrency(item.amount)}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{ width: `${barWidth}%`, backgroundColor: item.fill }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  loading,
  color,
}: {
  label: string
  value: string
  sub: string
  loading: boolean
  color: "navy" | "blue" | "red" | "green" | "gray"
}) {
  const colorClass = {
    navy:  "text-blue-900",
    blue:  "text-blue-600",
    red:   "text-red-600",
    green: "text-emerald-600",
    gray:  "text-gray-600",
  }[color]

  return (
    <div className="border border-gray-200 p-3 sm:p-5 space-y-2 sm:space-y-3">
      <p className="text-[10px] sm:text-xs font-sans tracking-wider text-gray-400 uppercase leading-tight">{label}</p>
      {loading ? (
        <div className="h-6 w-24 sm:h-7 sm:w-32 bg-gray-100 animate-pulse rounded" />
      ) : (
        <p className="text-base sm:text-xl font-sans font-medium tabular-nums break-all text-gray-900">{value}</p>
      )}
      <p className="text-[10px] sm:text-xs font-sans text-gray-400">{sub}</p>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  loading,
  empty,
  emptyMessage = "No data",
  chartClassName,
  children,
}: {
  title: string
  subtitle: string
  loading: boolean
  empty: boolean
  emptyMessage?: string
  chartClassName?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 p-4 sm:p-6 flex flex-col gap-4">
      <div className="shrink-0">
        <h3 className="text-sm font-sans font-medium tracking-wide">{title}</h3>
        <p className="text-xs font-sans text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className={chartClassName ?? "flex-1 min-h-[200px] sm:min-h-[260px]"}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs font-mono text-gray-400 tracking-wider">Loading...</p>
          </div>
        ) : empty ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs font-mono text-gray-400 tracking-wider">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
