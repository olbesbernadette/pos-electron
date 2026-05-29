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
  Cell,
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

const branchColors: Record<number, string> = {
  1: "#0891b2",
  2: "#d97706",
  3: "#e11d48",
  4: "#7c3aed",
  5: "#059669",
  6: "#0284c7",
}

const expenseColors: Record<string, string> = {
  Payroll:   "#dc2626",
  Deposit:   "#2563eb",
  Repairs:   "#ea580c",
  Utilities: "#9333ea",
  "Port Fees": "#0891b2",
  Others:    "#6b7280",
}

const formatCurrency = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

const overviewConfig: ChartConfig = {
  sales:    { label: "Sales",    color: "#2563eb" },
  expenses: { label: "Expenses", color: "#dc2626" },
}

const depositsConfig: ChartConfig = {
  cash:  { label: "Cash",  color: "#059669" },
  check: { label: "Check", color: "#7c3aed" },
  gcash: { label: "GCash", color: "#2563eb" },
}

function localDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

type DateRangeOption = "today" | "mtd" | "last_month" | "year" | "custom"

function buildDayRange(from: string, to: string) {
  const result: { date: string; dateLabel: string }[] = []
  const cur = new Date(from + "T00:00:00")
  const end = new Date(to + "T00:00:00")
  while (cur <= end) {
    result.push({
      date: localDateString(cur),
      dateLabel: cur.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
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
      dateLabel: cur.toLocaleDateString("en-PH", { month: "short" }),
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

  // Fetch overview via RPCs
  const fetchOverview = useCallback(async () => {
    const range = computeRange(dateRangeOption, customFrom, customTo)
    if (!range.from || !range.to) return
    setOverviewLoading(true)
    const supabase = createClient()
    const [
      { data: salesExpenses, error: salesErr },
      { data: deposits, error: depositsErr },
    ] = await Promise.all([
      supabase.rpc("get_sales_overview", { p_from: range.from, p_to: range.to, p_branch_id: selectedBranch }),
      supabase.rpc("get_deposits_overview", { p_from: range.from, p_to: range.to, p_branch_id: selectedBranch }),
    ])
    if (salesErr) console.error("get_sales_overview:", salesErr.message)
    if (depositsErr) console.error("get_deposits_overview:", depositsErr.message)
    setSalesExpensesOverview(salesExpenses ?? [])
    setDepositsOverview(deposits ?? [])
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

  // Realtime: refetch RPCs when a deposit or shift close happens
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
    return () => {
      supabase.removeChannel(depositsChannel)
      supabase.removeChannel(totalsChannel)
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

  // Daily sales by branch (horizontal bar)
  const salesByBranch = useMemo(() => {
    const map: Record<number, number> = {}
    dailySales.forEach((t) => { map[t.branch_id] = (map[t.branch_id] || 0) + t.amount })
    return Object.entries(map)
      .map(([id, amount]) => ({
        branch: branchNames[+id] || `Branch ${id}`,
        amount,
        fill: branchColors[+id] || "#6b7280",
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [dailySales])

  // Daily expenses by type (horizontal bar)
  const expensesByType = useMemo(() => {
    const map: Record<number, number> = {}
    dailyExpenses.forEach((t) => { map[t.payment_type] = (map[t.payment_type] || 0) + t.amount })
    return Object.entries(map)
      .map(([type, amount]) => {
        const label = expenseTypeNames[+type] || `Type ${type}`
        return { type: label, amount, fill: expenseColors[label] || "#6b7280" }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [dailyExpenses])

  const activeRange = useMemo(
    () => computeRange(dateRangeOption, customFrom, customTo),
    [dateRangeOption, customFrom, customTo]
  )

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
        return `${new Date(customFrom + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${new Date(customTo + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`
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
    <div className="space-y-8">
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
        <span className="text-xs font-mono text-gray-400 tracking-wider">
          {new Date().toLocaleDateString("en-PH", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-3">
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

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap">
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
                      ? new Date(customFrom + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
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
                      ? new Date(customTo + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Daily Sales"
          value={formatCurrency(totalDailySales)}
          sub={`${dailySales.length} transactions`}
          loading={dailyLoading}
          color="blue"
        />
        <StatCard
          label="Daily Expenses"
          value={formatCurrency(totalDailyExpenses)}
          sub={`${dailyExpenses.length} entries`}
          loading={dailyLoading}
          color="red"
        />
        <StatCard
          label={`${rangeLabel} Deposits`}
          value={formatCurrency(totalDeposits)}
          sub="cash + check + gcash"
          loading={overviewLoading}
          color="green"
        />
        <StatCard
          label="Net (Sales − Exp)"
          value={formatCurrency(totalDailySales - totalDailyExpenses)}
          sub={hasOpenShift ? "shift open" : "no open shift"}
          loading={dailyLoading}
          color={totalDailySales - totalDailyExpenses >= 0 ? "green" : "red"}
        />
      </div>

      {/* Daily charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Daily Sales by Branch"
          subtitle="Current shift — updates in realtime"
          loading={dailyLoading}
          empty={salesByBranch.length === 0}
          emptyMessage={currentShiftId ? "No sales in current shift" : "No open shift"}
        >
          <ChartContainer config={{ amount: { label: "Sales" } }} className="h-[240px]">
            <BarChart
              data={salesByBranch}
              layout="vertical"
              margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                type="number"
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="branch"
                tick={{ fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={76}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => formatCurrency(Number(v))}
                    hideLabel
                  />
                }
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {salesByBranch.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title="Daily Expenses by Type"
          subtitle="Current shift — updates in realtime"
          loading={dailyLoading}
          empty={expensesByType.length === 0}
          emptyMessage={currentShiftId ? "No expenses in current shift" : "No open shift"}
        >
          <ChartContainer config={{ amount: { label: "Expenses" } }} className="h-[240px]">
            <BarChart
              data={expensesByType}
              layout="vertical"
              margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                type="number"
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="type"
                tick={{ fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                width={76}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(v) => formatCurrency(Number(v))}
                    hideLabel
                  />
                }
              />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {expensesByType.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* 7-day overview charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title={`Sales & Expenses — ${rangeLabel}`}
          subtitle={groupBy === "month" ? "Grouped by month" : "Grouped by day"}
          loading={overviewLoading}
          empty={false}
        >
          <ChartContainer config={overviewConfig} className="h-[240px]">
            <AreaChart data={overviewData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fontFamily: "monospace" }}
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
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#gradSales)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#dc2626"
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
          <ChartContainer config={depositsConfig} className="h-[240px]">
            <BarChart data={depositsData} margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fontFamily: "monospace" }}
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
              <Bar dataKey="cash" stackId="a" fill="var(--color-cash)" maxBarSize={40} />
              <Bar dataKey="check" stackId="a" fill="var(--color-check)" maxBarSize={40} />
              <Bar dataKey="gcash" stackId="a" fill="var(--color-gcash)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>
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
  color: "blue" | "red" | "green" | "gray"
}) {
  const colorClass = {
    blue:  "text-blue-600",
    red:   "text-red-600",
    green: "text-emerald-600",
    gray:  "text-gray-600",
  }[color]

  return (
    <div className="border border-gray-200 p-5 space-y-3">
      <p className="text-xs font-mono tracking-wider text-gray-400 uppercase">{label}</p>
      {loading ? (
        <div className="h-7 w-32 bg-gray-100 animate-pulse rounded" />
      ) : (
        <p className={`text-xl font-mono font-medium tabular-nums ${colorClass}`}>{value}</p>
      )}
      <p className="text-xs font-mono text-gray-400">{sub}</p>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  loading,
  empty,
  emptyMessage = "No data",
  children,
}: {
  title: string
  subtitle: string
  loading: boolean
  empty: boolean
  emptyMessage?: string
  children?: React.ReactNode
}) {
  return (
    <div className="border border-gray-200 p-6 space-y-4">
      <div>
        <h3 className="text-sm font-medium tracking-wide">{title}</h3>
        <p className="text-xs font-mono text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {loading ? (
        <div className="h-[240px] flex items-center justify-center">
          <p className="text-xs font-mono text-gray-400 tracking-wider">Loading...</p>
        </div>
      ) : empty ? (
        <div className="h-[240px] flex items-center justify-center">
          <p className="text-xs font-mono text-gray-400 tracking-wider">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
