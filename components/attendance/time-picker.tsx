"use client"

import { useState } from "react"
import { Clock } from "@phosphor-icons/react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))

interface TimePickerProps {
  value: string // 24-hour "HH:MM", empty string if unset
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

export function TimePicker({ value, onChange, className, disabled }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [hour24, minute] = value ? value.split(":").map(Number) : [null, null]
  const hour12 = hour24 === null ? "" : ((hour24 % 12) || 12).toString()
  const period = hour24 === null ? "AM" : hour24 >= 12 ? "PM" : "AM"
  const minuteStr = minute === null ? "" : minute.toString().padStart(2, "0")

  const commit = (nextHour12: string, nextMinute: string, nextPeriod: string) => {
    if (!nextHour12 || !nextMinute) return
    let h = parseInt(nextHour12) % 12
    if (nextPeriod === "PM") h += 12
    onChange(`${h.toString().padStart(2, "0")}:${nextMinute}`)
  }

  const display =
    value === "00:00"
      ? "Absent"
      : value
      ? `${hour12}:${minuteStr} ${period}`
      : "--:-- --"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-[110px] px-3 py-2 text-sm font-mono border border-gray-200 rounded-md flex items-center justify-between gap-1.5 focus:outline-none focus:border-black transition-colors",
            disabled && "opacity-60 cursor-not-allowed bg-gray-50",
            className,
          )}
        >
          <span className={value === "00:00" ? "text-red-500" : value ? "text-black" : "text-gray-400"}>{display}</span>
          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          <Select value={hour12} onValueChange={(v) => commit(v, minuteStr || "00", period)}>
            <SelectTrigger className="w-[70px] text-sm font-mono">
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent>
              {hours.map((h) => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-gray-400">:</span>
          <Select value={minuteStr} onValueChange={(v) => commit(hour12 || "12", v, period)}>
            <SelectTrigger className="w-[70px] text-sm font-mono">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {minutes.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => commit(hour12 || "12", minuteStr || "00", v)}>
            <SelectTrigger className="w-[72px] text-sm font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              onChange("00:00")
              setOpen(false)
            }}
          >
            Absent
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setOpen(false)}
          >
            Ok
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
