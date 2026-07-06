"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { CaretDown } from "@phosphor-icons/react"
import { format, parse, startOfWeek, endOfWeek } from "date-fns"
import type { DateRange } from "react-day-picker"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Shared look for the Employee / Date Range fields, matching AttendanceForm's header fields
const fieldClass =
  "w-full px-4 py-3 border border-gray-200 rounded-none font-mono text-left flex items-center justify-between focus:outline-none focus:border-black transition-colors"

interface EmployeeRow {
  id: string
  employee_name: string
  r_pay: number
  s_pay: number
  h_pay: number
  incentives: number
  sss: number
  phic: number
  pgbg: number
}

interface PayrollRow {
  attendance_date: string
  day: string
  day_type: string
  time_in: string | null
  time_out: string | null
  break_hours: string
  has_allowance: boolean
  allowance_amount: string
}

const dayTypeLabels: Record<string, string> = { R: "Regular", S: "Special", H: "Holiday" }

// "17:00" -> "5:00pm"
const formatTime12 = (time: string | null): string => {
  if (!time) return "—"
  const [h, m] = time.split(":").map(Number)
  return format(new Date(2000, 0, 1, h, m), "h:mm a").replace(" ", "").toLowerCase()
}

const intervalToHours = (interval: string | null): string => {
  if (!interval) return "0"
  const [h, m] = interval.split(":").map(Number)
  const total = (h || 0) + (m || 0) / 60
  return total.toString()
}

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

const SHIFT_START_MINUTES = 7 * 60 + 30 // 7:30am — clocking in earlier doesn't earn extra basic hours

// "00:00" is the Absent sentinel set by the time picker — not an actual midnight clock-in/out
const isAbsent = (timeIn: string | null, timeOut: string | null): boolean =>
  !timeIn || !timeOut || timeIn === "00:00" || timeOut === "00:00"

// Hours actually worked (time out - time in - break), capped at 8 — anything beyond 8 is overtime, not basic
const computeBasicHours = (timeIn: string | null, timeOut: string | null, breakHours: number): number => {
  if (isAbsent(timeIn, timeOut)) return 0
  const inMinutes = Math.max(timeToMinutes(timeIn!), SHIFT_START_MINUTES)
  let diff = timeToMinutes(timeOut!) - inMinutes
  if (diff < 0) diff += 24 * 60 // overnight shift
  const hours = Math.max(diff / 60 - breakHours, 0)
  return hours >= 8 ? 8 : hours
}

// Total hours actually worked (time out - time in - break), uncapped and using the real time in
const computeRawHours = (timeIn: string | null, timeOut: string | null, breakHours: number): number => {
  if (isAbsent(timeIn, timeOut)) return 0
  let diff = timeToMinutes(timeOut!) - timeToMinutes(timeIn!)
  if (diff < 0) diff += 24 * 60 // overnight shift
  return Math.max(diff / 60 - breakHours, 0)
}

// Anything worked beyond basic hours
const computeOtHours = (timeIn: string | null, timeOut: string | null, breakHours: number): number => {
  return Math.max(
    computeRawHours(timeIn, timeOut, breakHours) - computeBasicHours(timeIn, timeOut, breakHours),
    0
  )
}

interface PayrollFormProps {
  branchId: number
}

export function PayrollForm({ branchId }: PayrollFormProps) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [employeeId, setEmployeeId] = useState<string>("")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }))
  const [rangeOpen, setRangeOpen] = useState(false)
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID())

  // Period-level deductions / bonus (not per attendance day)
  const [valeAmount, setValeAmount] = useState("")
  const [sssOn, setSssOn] = useState(false)
  const [sssAmount, setSssAmount] = useState("")
  const [phicOn, setPhicOn] = useState(false)
  const [phicAmount, setPhicAmount] = useState("")
  const [pgbgOn, setPgbgOn] = useState(false)
  const [pgbgAmount, setPgbgAmount] = useState("")
  const [bonusAmount, setBonusAmount] = useState("")

  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_name, r_pay, s_pay, h_pay, incentives, sss, phic, pgbg")
        .eq("branch_id", branchId)
        .order("employee_name", { ascending: true })

      if (error) {
        toast.error("Failed to load employees")
        console.error(error)
      } else if (data) {
        setEmployees(data)
      }
      setIsLoadingEmployees(false)
    }
    fetchEmployees()
  }, [branchId])

  const handlePullAttendance = async () => {
    if (!employeeId) {
      toast.error("Select an employee first")
      return
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Select a date range first")
      return
    }

    setIsLoadingAttendance(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("attendance")
      .select("attendance_date, day, day_type, time_in, time_out, break_duration")
      .eq("employee_id", employeeId)
      .gte("attendance_date", format(dateRange.from, "yyyy-MM-dd"))
      .lte("attendance_date", format(dateRange.to, "yyyy-MM-dd"))
      .order("attendance_date", { ascending: true })

    setIsLoadingAttendance(false)
    if (error) {
      toast.error("Failed to load attendance for this employee")
      console.error(error)
      return
    }

    setRows(
      (data ?? []).map((row: any) => ({
        attendance_date: row.attendance_date,
        day: row.day,
        day_type: row.day_type,
        time_in: row.time_in?.slice(0, 5) ?? null,
        time_out: row.time_out?.slice(0, 5) ?? null,
        break_hours: intervalToHours(row.break_duration),
        has_allowance: false,
        allowance_amount: "",
      }))
    )

    // Reset period-level deductions/bonus for the newly pulled employee/range
    setValeAmount("")
    setSssOn(false)
    setSssAmount("")
    setPhicOn(false)
    setPhicAmount("")
    setPgbgOn(false)
    setPgbgAmount("")
    setBonusAmount("")
  }

  const updateRow = (attendanceDate: string, field: keyof PayrollRow, value: string | boolean) => {
    setRows(prev =>
      prev.map(r => (r.attendance_date === attendanceDate ? { ...r, [field]: value } : r))
    )
  }

  const selectedEmployee = employees.find(e => e.id === employeeId)
  const rPay = selectedEmployee?.r_pay ?? 0
  const sPay = selectedEmployee?.s_pay ?? 0
  const hPay = selectedEmployee?.h_pay ?? 0
  const incentives = selectedEmployee?.incentives ?? 0

  // Turning the allowance on fills in the employee's incentives amount; turning it off clears it
  const toggleAllowance = (attendanceDate: string, checked: boolean) => {
    setRows(prev =>
      prev.map(r =>
        r.attendance_date === attendanceDate
          ? { ...r, has_allowance: checked, allowance_amount: checked ? incentives.toString() : "" }
          : r
      )
    )
  }

  // Same on/off + prefill pattern as the allowance toggle, but for the period-level deductions
  const toggleSss = (checked: boolean) => {
    setSssOn(checked)
    setSssAmount(checked ? (selectedEmployee?.sss ?? 0).toString() : "")
  }
  const togglePhic = (checked: boolean) => {
    setPhicOn(checked)
    setPhicAmount(checked ? (selectedEmployee?.phic ?? 0).toString() : "")
  }
  const togglePgbg = (checked: boolean) => {
    setPgbgOn(checked)
    setPgbgAmount(checked ? (selectedEmployee?.pgbg ?? 0).toString() : "")
  }

  // Basic pay rate depends on the day type: Regular uses r_pay, Special uses s_pay, Holiday uses h_pay
  const basicRateForDayType = (dayType: string): number => {
    if (dayType === "S") return sPay
    if (dayType === "H") return hPay
    return rPay
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const breakHours = parseFloat(r.break_hours) || 0
        acc.basicPay += computeBasicHours(r.time_in, r.time_out, breakHours) * basicRateForDayType(r.day_type)
        acc.otPay += computeOtHours(r.time_in, r.time_out, breakHours) * sPay
        acc.allowance += r.has_allowance ? parseFloat(r.allowance_amount) || 0 : 0
        return acc
      },
      { basicPay: 0, otPay: 0, allowance: 0 }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rPay, sPay, hPay])

  const totalPay = totals.basicPay + totals.otPay + totals.allowance

  const deductions = {
    vale: parseFloat(valeAmount) || 0,
    sss: sssOn ? parseFloat(sssAmount) || 0 : 0,
    phic: phicOn ? parseFloat(phicAmount) || 0 : 0,
    pgbg: pgbgOn ? parseFloat(pgbgAmount) || 0 : 0,
  }
  const totalDeductions = deductions.vale + deductions.sss + deductions.phic + deductions.pgbg
  const bonus = parseFloat(bonusAmount) || 0
  const netPay = totalPay - totalDeductions + bonus

  const handleSubmit = async () => {
    if (!employeeId || !dateRange?.from || !dateRange?.to) {
      toast.error("Select an employee and date range first")
      return
    }
    if (rows.length === 0) {
      toast.error("Pull attendance before submitting")
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from("payroll_records").upsert(
      {
        employee_id: employeeId,
        branch_id: branchId,
        period_start: format(dateRange.from, "yyyy-MM-dd"),
        period_end: format(dateRange.to, "yyyy-MM-dd"),
        basic_pay: totals.basicPay,
        ot_pay: totals.otPay,
        allowance: totals.allowance,
        total_pay: totalPay,
        vale: deductions.vale,
        sss: deductions.sss,
        phic: deductions.phic,
        pgbg: deductions.pgbg,
        bonus,
        net_pay: netPay,
        idempotency_key: idempotencyKeyRef.current,
      },
      { onConflict: "employee_id,period_start,period_end" }
    )

    setIsSubmitting(false)
    if (error) {
      toast.error("Failed to submit payroll")
      console.error(error)
      return
    }
    toast.success("Payroll submitted")
    idempotencyKeyRef.current = crypto.randomUUID()
    setShowPrintDialog(true)
  }

  // 80mm receipt paper — same character width used for the app's other thermal receipts
  const RECEIPT_WIDTH = 47

  const printPayslip = async () => {
    if (!selectedEmployee || !dateRange?.from || !dateRange?.to) {
      setShowPrintDialog(false)
      return
    }

    const divider = "-".repeat(RECEIPT_WIDTH)
    const money = (n: number) => n.toFixed(2)
    const row = (label: string, amount: string) => {
      const amountStr = amount
      const labelWidth = Math.max(RECEIPT_WIDTH - amountStr.length, 0)
      return `${label.substring(0, labelWidth).padEnd(labelWidth)}${amountStr}`
    }
    const period = `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`

    try {
      const isElectron = (window as any).electronAPI?.isElectron

      if (isElectron) {
        const lines: { text: string; align: "left" | "center" | "right"; bold?: boolean }[] = [
          { text: "PAYSLIP", align: "center", bold: true },
          { text: selectedEmployee.employee_name, align: "center" },
          { text: period, align: "center" },
          { text: divider, align: "center" },
          { text: row("Basic Pay", money(totals.basicPay)), align: "left" },
          { text: row("OT Pay", money(totals.otPay)), align: "left" },
          { text: row("Allowance", money(totals.allowance)), align: "left" },
          { text: divider, align: "center" },
          { text: row("Total Pay", money(totalPay)), align: "left", bold: true },
          { text: divider, align: "center" },
          { text: "DEDUCTIONS", align: "left", bold: true },
          { text: row("Vale", money(deductions.vale)), align: "left" },
          { text: row("SSS", money(deductions.sss)), align: "left" },
          { text: row("PHIC", money(deductions.phic)), align: "left" },
          { text: row("PGBG", money(deductions.pgbg)), align: "left" },
          { text: divider, align: "center" },
          { text: row("Bonus", money(bonus)), align: "left" },
          { text: divider, align: "center" },
          { text: row("Net Pay", money(netPay)), align: "left", bold: true },
          { text: divider, align: "center" },
          { text: "-- end of payslip --", align: "center" },
          { text: "", align: "left" },
          { text: "", align: "left" },
          { text: "Received by: ___________________", align: "left" },
        ]

        const result = await (window as any).electronAPI.printReceipt({ lines })
        if (!result.success) {
          console.error("[payroll] Electron print failed:", result.error)
          toast.error("Failed to print payslip")
        }
      } else {
        toast.error("Printing is only available in the desktop app")
      }
    } catch (err) {
      console.error("[payroll] Print error:", err)
      toast.error("Print error occurred")
    }

    setShowPrintDialog(false)
  }

  const rangeLabel =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
      : dateRange?.from
      ? format(dateRange.from, "MMM d, yyyy")
      : "Select date range"

  return (
    <div className="space-y-6">
      {/* Employee / Date Range / Pull */}
      <div className="border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Employee
            </label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className={cn(fieldClass, "rounded-none shadow-none text-base focus-visible:ring-0 data-[size=default]:h-auto")}>
                <SelectValue className="text-black" placeholder={isLoadingEmployees ? "Loading..." : "Select employee"} />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.employee_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Date Range
            </label>
            <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={fieldClass}>
                  <span className={dateRange?.from ? "text-black" : "text-gray-400"}>{rangeLabel}</span>
                  <CaretDown className="w-4 h-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  defaultMonth={dateRange?.from}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handlePullAttendance}
              disabled={isLoadingAttendance}
              className={`w-full py-3 font-mono tracking-wider uppercase text-sm transition-colors ${
                isLoadingAttendance
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              {isLoadingAttendance ? "Loading..." : "Pull Attendance"}
            </button>
          </div>
        </div>
      </div>

      {/* Payroll table */}
      <div className="border border-gray-200 rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Date</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Day</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Type</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Time In</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Time Out</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Break (hrs)</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Basic Hours</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Basic Pay</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">OT Hours</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">OT Pay</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500 whitespace-nowrap">Allowance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingAttendance ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-gray-400 font-sans text-sm">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map(row => (
                <TableRow key={row.attendance_date}>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-sans">
                    {format(parse(row.attendance_date, "yyyy-MM-dd", new Date()), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-sans capitalize">{row.day}</TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-sans">
                    {dayTypeLabels[row.day_type] ?? row.day_type}
                  </TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-mono">{formatTime12(row.time_in)}</TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-mono">{formatTime12(row.time_out)}</TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-mono">{row.break_hours}</TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-mono">
                    {computeBasicHours(row.time_in, row.time_out, parseFloat(row.break_hours) || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-mono">
                    {(computeBasicHours(row.time_in, row.time_out, parseFloat(row.break_hours) || 0) * basicRateForDayType(row.day_type)).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-mono">
                    {computeOtHours(row.time_in, row.time_out, parseFloat(row.break_hours) || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm py-3 whitespace-nowrap font-mono">
                    {(computeOtHours(row.time_in, row.time_out, parseFloat(row.break_hours) || 0) * sPay).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.has_allowance}
                        onCheckedChange={(checked) => toggleAllowance(row.attendance_date, checked)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        disabled={!row.has_allowance}
                        value={row.allowance_amount}
                        onChange={(e) => updateRow(row.attendance_date, "allowance_amount", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right disabled:bg-gray-50 disabled:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-gray-400 font-sans text-sm">
                  No attendance data loaded yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {rows.length > 0 && (
        <div className="border border-gray-200 p-6 max-w-sm ml-auto space-y-4 text-sm font-sans">
          {/* Subtotals */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Basic Pay</span>
              <span className="font-mono">{totals.basicPay.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">OT Pay</span>
              <span className="font-mono">{totals.otPay.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Allowance</span>
              <span className="font-mono">{totals.allowance.toFixed(2)}</span>
            </div>
          </div>

          {/* Total Pay */}
          <div className="border-t border-gray-200 pt-3 flex items-center justify-between font-medium">
            <span>Total Pay</span>
            <span className="font-mono">{totalPay.toFixed(2)}</span>
          </div>

          {/* Deductions */}
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <p className="text-xs text-gray-500 font-mono tracking-wider uppercase">Deductions</p>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Vale</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={valeAmount}
                onChange={(e) => setValeAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={sssOn} onCheckedChange={toggleSss} />
                <span className="text-gray-500">SSS</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={!sssOn}
                value={sssAmount}
                onChange={(e) => setSssAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right disabled:bg-gray-50 disabled:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={phicOn} onCheckedChange={togglePhic} />
                <span className="text-gray-500">PHIC</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={!phicOn}
                value={phicAmount}
                onChange={(e) => setPhicAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right disabled:bg-gray-50 disabled:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={pgbgOn} onCheckedChange={togglePgbg} />
                <span className="text-gray-500">PGBG</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={!pgbgOn}
                value={pgbgAmount}
                onChange={(e) => setPgbgAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right disabled:bg-gray-50 disabled:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Bonus */}
          <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
            <span className="text-gray-500">Bonus</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              onFocus={(e) => e.target.select()}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Net Pay */}
          <div className="border-t border-gray-200 pt-3 flex items-center justify-between font-medium text-base">
            <span>Net Pay</span>
            <span className="font-mono">{netPay.toFixed(2)}</span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full py-3 font-mono tracking-wider uppercase text-sm transition-colors ${
              isSubmitting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            {isSubmitting ? "Submitting..." : "Submit Payroll"}
          </button>
        </div>
      )}

      {/* Print Dialog */}
      {showPrintDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white border border-gray-200 p-8 w-80 shadow-lg">
            <h2 className="text-base font-medium tracking-wide mb-1">Print Payslip?</h2>
            <p className="text-xs text-gray-500 font-mono mb-6">
              Payroll submitted for {selectedEmployee?.employee_name}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={printPayslip}
                className="flex-1 px-4 py-2.5 bg-black text-white text-xs font-mono tracking-widest uppercase hover:bg-gray-900 transition-colors"
              >
                Yes, Print
              </button>
              <button
                onClick={() => setShowPrintDialog(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-xs font-mono tracking-widest uppercase hover:border-black transition-colors"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
