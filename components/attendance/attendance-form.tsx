"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { CaretDown, ArrowUp, ArrowDown, CaretUpDown } from "@phosphor-icons/react"
import { format, parse, getDay } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TimePicker } from "./time-picker"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Shared look for the Date / Day / Day Type fields so they stay visually uniform
const fieldClass =
  "w-full px-4 py-3 border border-gray-200 rounded-none font-mono text-left flex items-center justify-between focus:outline-none focus:border-black transition-colors"

interface EmployeeRow {
  id: string
  employee_name: string
  employee_type: string | null
}

interface AttendanceEntry {
  time_in: string
  time_out: string
  break_hours: string
}

// Default entry for employees with no saved attendance yet for the selected date
const emptyEntry: AttendanceEntry = { time_in: "07:30", time_out: "17:00", break_hours: "1" }

const dayTypeLabels: Record<string, string> = { R: "R - Regular", S: "S - Special", H: "H - Holiday" }

// Sunday defaults to Special day type; every other day defaults to Regular
const defaultDayType = (dateStr: string): string => {
  const parsed = parse(dateStr, "yyyy-MM-dd", new Date())
  return getDay(parsed) === 0 ? "S" : "R"
}

// Postgres returns interval as "HH:MM:SS" — convert to decimal hours for the input
const intervalToHours = (interval: string | null): string => {
  if (!interval) return ""
  const [h, m] = interval.split(":").map(Number)
  const total = (h || 0) + (m || 0) / 60
  return total ? total.toString() : ""
}

interface AttendanceFormProps {
  branchId: number
}

type SortField = "employee_type" | "employee_name"

export function AttendanceForm({ branchId }: AttendanceFormProps) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [entries, setEntries] = useState<Record<string, AttendanceEntry>>({})
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"))
  const [dayType, setDayType] = useState<string>(() => defaultDayType(format(new Date(), "yyyy-MM-dd")))
  const [dateOpen, setDateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [sortField, setSortField] = useState<SortField>("employee_type")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const aVal = (a[sortField] ?? "").toLowerCase()
      const bVal = (b[sortField] ?? "").toLowerCase()
      if (aVal === bVal) return a.employee_name.localeCompare(b.employee_name)
      const cmp = aVal < bVal ? -1 : 1
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [employees, sortField, sortDir])

  const loadAttendance = useCallback(async (employeeIds: string[], attendanceDate: string) => {
    if (employeeIds.length === 0) {
      setEntries({})
      setDayType(defaultDayType(attendanceDate))
      return
    }

    const supabase = createClient()
    const { data: rows, error } = await supabase
      .from("attendance")
      .select("employee_id, time_in, time_out, break_duration, day_type")
      .eq("attendance_date", attendanceDate)
      .in("employee_id", employeeIds)

    if (error) {
      toast.error("Failed to load attendance for this date")
      console.error(error)
      return
    }

    const nextEntries: Record<string, AttendanceEntry> = {}
    rows?.forEach((row: any) => {
      nextEntries[row.employee_id] = {
        time_in: row.time_in?.slice(0, 5) ?? "",
        time_out: row.time_out?.slice(0, 5) ?? "",
        break_hours: intervalToHours(row.break_duration),
      }
    })
    setEntries(nextEntries)
    setDayType(rows && rows.length > 0 ? rows[0].day_type : defaultDayType(attendanceDate))
  }, [])

  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoading(true)
      const supabase = createClient()
      const { data: rows, error } = await supabase
        .from("employees")
        .select("id, employee_name, employee_type")
        .eq("branch_id", branchId)

      if (error) {
        toast.error("Failed to load employees")
        console.error(error)
      } else if (rows) {
        setEmployees(rows)
        await loadAttendance(rows.map(r => r.id), date)
      }
      setIsLoading(false)
    }
    fetchEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  const handleDateSelect = async (newDate: Date | undefined) => {
    if (!newDate) return
    const dateStr = format(newDate, "yyyy-MM-dd")
    setDate(dateStr)
    setDateOpen(false)
    await loadAttendance(employees.map(e => e.id), dateStr)
  }

  const updateEntry = (employeeId: string, field: keyof AttendanceEntry, value: string) => {
    setEntries(prev => ({
      ...prev,
      [employeeId]: { ...(prev[employeeId] ?? emptyEntry), [field]: value },
    }))
  }

  const handleSave = async () => {
    const rows = employees
      .map(emp => {
        const entry = entries[emp.id] ?? emptyEntry
        if (!entry.time_in && !entry.time_out) return null
        return {
          employee_id: emp.id,
          attendance_date: date,
          day_type: dayType,
          time_in: entry.time_in || null,
          time_out: entry.time_out || null,
          break_duration: `${parseFloat(entry.break_hours) || 0} hours`,
          idempotency_key: crypto.randomUUID(),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length === 0) {
      toast.error("Enter at least a time in or time out for one employee")
      return
    }

    setIsSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "employee_id,attendance_date" })

    setIsSaving(false)
    if (error) {
      toast.error("Failed to save attendance")
      console.error(error)
      return
    }
    toast.success("Attendance saved")
  }

  const dayLabel = format(parse(date, "yyyy-MM-dd", new Date()), "EEEE")

  return (
    <div className="space-y-6">
      {/* Date / Day / Day Type */}
      <div className="border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Date
            </label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={fieldClass}>
                  <span className="text-black">
                    {format(parse(date, "yyyy-MM-dd", new Date()), "PPP")}
                  </span>
                  <CaretDown className="w-4 h-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parse(date, "yyyy-MM-dd", new Date())}
                  onSelect={handleDateSelect}
                  defaultMonth={parse(date, "yyyy-MM-dd", new Date())}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Day
            </label>
            <div className={fieldClass}>
              <span className="text-black">{dayLabel}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
              Day Type
            </label>
            <Select value={dayType} onValueChange={setDayType}>
              <SelectTrigger className={cn(fieldClass, "rounded-none shadow-none text-base focus-visible:ring-0 data-[size=default]:h-auto")}>
                <SelectValue className="text-black" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="R">{dayTypeLabels.R}</SelectItem>
                <SelectItem value="S">{dayTypeLabels.S}</SelectItem>
                <SelectItem value="H">{dayTypeLabels.H}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Employees — mobile card list */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans text-gray-500">Sort:</span>
          {(["employee_type", "employee_name"] as SortField[]).map(field => (
            <button
              key={field}
              type="button"
              onClick={() => toggleSort(field)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-sans border border-gray-200 rounded-full hover:border-black transition-colors"
            >
              {field === "employee_type" ? "Type" : "Employee"}
              {sortField === field ? (
                sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              ) : (
                <CaretUpDown className="w-3 h-3 text-gray-400" />
              )}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="border border-gray-200 rounded-md h-24 flex items-center justify-center text-gray-400 font-sans text-sm">
            Loading...
          </div>
        ) : sortedEmployees.length ? (
          sortedEmployees.map(emp => {
            const entry = entries[emp.id] ?? emptyEntry
            return (
              <div key={emp.id} className="border border-gray-200 rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans font-medium text-sm">{emp.employee_name}</span>
                  {emp.employee_type ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-100/50 text-gray-700 border-gray-300">
                      {emp.employee_type}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase">Time In</label>
                    <TimePicker
                      value={entry.time_in}
                      onChange={(v) => updateEntry(emp.id, "time_in", v)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase">Time Out</label>
                    <TimePicker
                      value={entry.time_out}
                      onChange={(v) => updateEntry(emp.id, "time_out", v)}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase">Break (hrs)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    placeholder="0"
                    value={entry.break_hours}
                    onChange={(e) => updateEntry(emp.id, "break_hours", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            )
          })
        ) : (
          <div className="border border-gray-200 rounded-md h-24 flex items-center justify-center text-gray-400 font-sans text-sm">
            No employees found for this branch
          </div>
        )}
      </div>

      {/* Employees table — larger screens */}
      <div className="hidden sm:block border border-gray-200 rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500">
                <button
                  className="flex items-center gap-1 hover:text-black transition-colors"
                  onClick={() => toggleSort("employee_type")}
                >
                  Type
                  {sortField === "employee_type" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <CaretUpDown className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500">
                <button
                  className="flex items-center gap-1 hover:text-black transition-colors"
                  onClick={() => toggleSort("employee_name")}
                >
                  Employee
                  {sortField === "employee_name" ? (
                    sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                  ) : (
                    <CaretUpDown className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500">Time In</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500">Time Out</TableHead>
              <TableHead className="text-xs font-sans tracking-wider uppercase text-gray-500">Break (hrs)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-gray-400 font-sans text-sm">
                  Loading...
                </TableCell>
              </TableRow>
            ) : sortedEmployees.length ? (
              sortedEmployees.map(emp => {
                const entry = entries[emp.id] ?? emptyEntry
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="text-sm py-3">
                      {emp.employee_type ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-100/50 text-gray-700 border-gray-300">
                          {emp.employee_type}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm py-3 font-sans font-medium">{emp.employee_name}</TableCell>
                    <TableCell className="text-sm py-3">
                      <TimePicker
                        value={entry.time_in}
                        onChange={(v) => updateEntry(emp.id, "time_in", v)}
                      />
                    </TableCell>
                    <TableCell className="text-sm py-3">
                      <TimePicker
                        value={entry.time_out}
                        onChange={(v) => updateEntry(emp.id, "time_out", v)}
                      />
                    </TableCell>
                    <TableCell className="text-sm py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="0"
                        value={entry.break_hours}
                        onChange={(e) => updateEntry(emp.id, "break_hours", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-24 px-3 py-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:border-black transition-colors text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-gray-400 font-sans text-sm">
                  No employees found for this branch
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || employees.length === 0}
        className={`w-full py-3 font-mono tracking-wider uppercase text-sm transition-colors ${
          isSaving || employees.length === 0
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        {isSaving ? "Saving..." : "Save Attendance"}
      </button>
    </div>
  )
}
