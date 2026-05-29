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

function buildDateRange(days: number) {
  const result: { date: string; dateLabel: string }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    result.push({
      date: localDateString(d),
      dateLabel: d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    })
  }
  return result
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

  // Fetch 7-day overview via RPCs
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true)
    const supabase = createClient()
    const [{ data: salesExpenses }, { data: deposits }] = await Promise.all([
      supabase.rpc("get_sales_overview", { p_days: 7, p_branch_id: selectedBranch }),
      supabase.rpc("get_deposits_overview", { p_days: 7, p_branch_id: selectedBranch }),
    ])
    if (salesExpenses) setSalesExpensesOverview(salesExpenses)
    if (deposits) setDepositsOverview(deposits)
    setOverviewLoading(false)
  }, [selectedBranch])

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

  // 7-day sales & expenses trend
  const overviewData = useMemo(() => {
    const days = buildDateRange(7).map((d) => ({ ...d, sales: 0, expenses: 0 }))

    salesExpensesOverview.forEach((item) => {
      const entry = days.find((d) => d.date === item.date)
      if (entry) {
        entry.sales += Number(item.total_sales)
        entry.expenses += Number(item.total_expenses)
      }
    })

    // Include current open shift in today's totals (not yet in shift_totals)
    if (hasOpenShift) {
      const today = localDateString(new Date())
      const todayEntry = days.find((d) => d.date === today)
      if (todayEntry) {
        todayEntry.sales += totalDailySales
        todayEntry.expenses += totalDailyExpenses
      }
    }

    return days
  }, [salesExpensesOverview, totalDailySales, totalDailyExpenses, hasOpenShift])

  // 7-day deposits trend
  const depositsData = useMemo(() => {
    const days = buildDateRange(7).map((d) => ({ ...d, cash: 0, check: 0, gcash: 0 }))

    depositsOverview.forEach((item) => {
      const entry = days.find((d) => d.date === item.date)
      if (entry) {
        const amt = Number(item.total_amount)
        if (item.deposit_type === 1) entry.cash += amt
        else if (item.deposit_type === 2) entry.check += amt
        else if (item.deposit_type === 3) entry.gcash += amt
      }
    })

    return days
  }, [depositsOverview])

  const todayDeposits = useMemo(() => {
    const today = localDateString(new Date())
    const entry = depositsData.find((d) => d.date === today)
    return entry ? entry.cash + entry.check + entry.gcash : 0
  }, [depositsData])

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

      {/* Branch filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider shrink-0">Branch:</span>
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
          label="Today's Deposits"
          value={formatCurrency(todayDeposits)}
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
          title="Sales & Expenses — Last 7 Days"
          subtitle="Closed shifts + current open shift"
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
          title="Deposits — Last 7 Days"
          subtitle="By type: cash, check, gcash"
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
