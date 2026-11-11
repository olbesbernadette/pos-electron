"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { WarningCircle, CheckCircle, CircleNotch } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { toast } from "sonner"

interface ShiftTotalsSummary {
  branch_id: number
  branch_name: string
  transaction_type: number
  transaction_type_name: string
  payment_type: number
  payment_type_name: string
  total_amount: number
  total_payment: number
  transaction_count: number
}

interface ShiftCheck {
  branch_id: number
  amount: number
  bank_name: string | null
  check_number: string | null
  check_date: string | null
}

interface ShiftExpense {
  branch_id: number
  payment_type: number
  amount: number
  description: string | null
}

interface ShiftPrintDetails {
  startTime: string | null
  checks: ShiftCheck[]
  expenses: ShiftExpense[]
}

interface CloseShiftDialogProps {
  isOpen: boolean
  onClose: () => void
  shiftId: number | null
  onShiftClosed: () => void
  userEmail: string
  userId: string
}

const branchNames: Record<number, string> = {
  1: "Hardware",
  2: "Pawa Gas",
  3: "Matnog Gas",
  4: "Gotis Hotel",
  5: "Rental",
  6: "Boarders",
}

const transactionTypeNames: Record<number, string> = {
  1: "Sales",
  2: "Expenses",
}

const paymentTypeNames: Record<number, string> = {
  1: "Cash",
  2: "GCash",
  3: "Check",
  4: "Credit",
  5: "Payroll",
  6: "Deposit",
  7: "Repairs",
  8: "Utilities",
  9: "Port Fees",
  10: "Others",
}

export function CloseShiftDialog({ isOpen, onClose, shiftId, onShiftClosed, userEmail, userId }: CloseShiftDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [summary, setSummary] = useState<ShiftTotalsSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [printDetails, setPrintDetails] = useState<ShiftPrintDetails | null>(null)

  // Fetch shift summary when dialog opens
  useEffect(() => {
    if (isOpen && shiftId) {
      fetchShiftSummary()
    } else {
      // Reset state when dialog closes
      setSummary([])
      setPrintDetails(null)
      setError(null)
      setSuccess(false)
    }
  }, [isOpen, shiftId])

  const fetchShiftSummary = async () => {
    if (!shiftId) return

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const { data, error: rpcError } = await supabase.rpc("fetch_shift_totals_summary", {
        p_shift_id: shiftId,
      })

      if (rpcError) {
        setError(rpcError.message || "Failed to fetch shift summary")
        return
      }

      // Map the data with friendly names
      const mappedData: ShiftTotalsSummary[] = (data || []).map((item: any) => ({
        ...item,
        branch_name: branchNames[item.branch_id] || `Branch ${item.branch_id}`,
        transaction_type_name: transactionTypeNames[item.transaction_type] || `Type ${item.transaction_type}`,
        payment_type_name: paymentTypeNames[item.payment_type] || `Payment ${item.payment_type}`,
      }))

      setSummary(mappedData)
      setPrintDetails(await fetchPrintDetails(shiftId))
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch the itemized checks and expenses for the printed shift summary
  const fetchPrintDetails = async (id: number): Promise<ShiftPrintDetails> => {
    const supabase = createClient()

    const [shiftRes, checkTxnRes, expenseRes] = await Promise.all([
      supabase.from("shifts").select("start_time").eq("id", id).single(),
      supabase
        .from("shift_transactions")
        .select("id, branch_id, amount")
        .eq("shift_id", id)
        .eq("transaction_type", 1)
        .eq("payment_type", 3)
        .order("id", { ascending: true }),
      supabase
        .from("shift_transactions")
        .select("id, branch_id, payment_type, amount, details1")
        .eq("shift_id", id)
        .eq("transaction_type", 2)
        .order("id", { ascending: true }),
    ])

    const checkTxns = checkTxnRes.data || []
    let checkDetailsById: Record<number, any> = {}
    if (checkTxns.length > 0) {
      const { data: details } = await supabase
        .from("check_details")
        .select("transaction_id, bank_name, check_number, check_date, check_amount")
        .in("transaction_id", checkTxns.map((t: any) => t.id))
      checkDetailsById = Object.fromEntries((details || []).map((d: any) => [d.transaction_id, d]))
    }

    return {
      startTime: shiftRes.data?.start_time ?? null,
      checks: checkTxns.map((t: any) => {
        const d = checkDetailsById[t.id]
        return {
          branch_id: t.branch_id,
          amount: Number(d?.check_amount ?? t.amount) || 0,
          bank_name: d?.bank_name ?? null,
          check_number: d?.check_number ?? null,
          check_date: d?.check_date ?? null,
        }
      }),
      expenses: (expenseRes.data || []).map((e: any) => ({
        branch_id: e.branch_id,
        payment_type: e.payment_type,
        amount: Number(e.amount) || 0,
        description: e.details1 ?? null,
      })),
    }
  }

  const printShiftSummary = async () => {
    const isElectron = (window as any).electronAPI?.isElectron
    if (!isElectron) return

    const fmt = (n: number) =>
      n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const separator = { text: "-----------------------------------------------", align: "center" as const }
    const blank = { text: "", align: "left" as const }
    const line = (text: string, bold = false) => ({ text, align: "left" as const, bold })

    const salesByPayment = (paymentType: number, branchId?: number) =>
      summary
        .filter(s =>
          s.transaction_type === 1 &&
          s.payment_type === paymentType &&
          (branchId === undefined || s.branch_id === branchId)
        )
        .reduce((sum, s) => sum + Number(s.total_amount), 0)

    // Branches that had any Cash/GCash/Check sales this shift, in branch order
    const salesBranchIds = Array.from(
      new Set(
        summary
          .filter(s => s.transaction_type === 1 && [1, 2, 3].includes(s.payment_type))
          .map(s => s.branch_id)
      )
    ).sort((a, b) => a - b)

    const cash = salesByPayment(1)
    const gcash = salesByPayment(2)
    const check = salesByPayment(3)
    const checks = printDetails?.checks || []
    const expenses = printDetails?.expenses || []
    const totalChecks = checks.reduce((sum, c) => sum + c.amount, 0)
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

    const receiptLines: { text: string; align: "left" | "center" | "right"; bold?: boolean }[] = [
      { text: "SHIFT SUMMARY", align: "center", bold: true },
      blank,
      line(`Shift ID: ${shiftId}`),
      ...(printDetails?.startTime
        ? [line(`Opened: ${format(new Date(printDetails.startTime), "MM/dd/yyyy hh:mm a")}`)]
        : []),
      line(`Closed: ${format(new Date(), "MM/dd/yyyy hh:mm a")}`),
      line(`Closed by: ${userEmail}`),
      separator,
      line("SALES", true),
      ...(salesBranchIds.length === 0
        ? [line("No sales")]
        : salesBranchIds.flatMap(branchId => {
            const bCash = salesByPayment(1, branchId)
            const bGcash = salesByPayment(2, branchId)
            const bCheck = salesByPayment(3, branchId)
            return [
              line(branchNames[branchId] || `Branch ${branchId}`, true),
              line(`  Cash: ${fmt(bCash)}`),
              line(`  GCash: ${fmt(bGcash)}`),
              line(`  Check: ${fmt(bCheck)}`),
              line(`  Subtotal: ${fmt(bCash + bGcash + bCheck)}`),
              blank,
            ]
          })),
      line("ALL BRANCHES", true),
      line(`Cash: ${fmt(cash)}`),
      line(`GCash: ${fmt(gcash)}`),
      line(`Check: ${fmt(check)}`),
      line(`Total: ${fmt(cash + gcash + check)}`, true),
      separator,
      line(`CHECKS (${checks.length})`, true),
      ...(checks.length === 0
        ? [line("No checks")]
        : checks.flatMap((c, i) => [
            line(`${i + 1}. ${c.bank_name || "-"} #${c.check_number || "-"}`),
            line(`   ${branchNames[c.branch_id] || `Branch ${c.branch_id}`}${c.check_date ? ` | ${c.check_date}` : ""}: ${fmt(c.amount)}`),
          ])),
      line(`Total Checks: ${fmt(totalChecks)}`, true),
      separator,
      line(`EXPENSES (${expenses.length})`, true),
      ...(expenses.length === 0
        ? [line("No expenses")]
        : expenses.map((e, i) => {
            const category = paymentTypeNames[e.payment_type] || `Type ${e.payment_type}`
            const branch = branchNames[e.branch_id] || `Branch ${e.branch_id}`
            return line(`${i + 1}. ${branch} - ${category}${e.description ? ` (${e.description})` : ""}: ${fmt(e.amount)}`)
          })),
      line(`Total Expenses: ${fmt(totalExpenses)}`, true),
      separator,
    ]

    try {
      const result = await (window as any).electronAPI.printReceipt({ lines: receiptLines })
      if (!result.success) {
        console.error("[v0] Electron print failed:", result.error)
        toast.error("Failed to print shift summary")
      }
    } catch (printError) {
      console.error("[v0] Print error:", printError)
      toast.error("Print error occurred")
    }
  }

  const handleConfirmClose = async () => {
    if (!shiftId) return

    setIsClosing(true)
    setError(null)

    const supabase = createClient()

    try {
      const { data, error: rpcError } = await supabase.rpc("close_shift", {
        p_shift_id: shiftId,
        p_closed_by: userEmail,
        p_closed_by_user: userId,
      })

      if (rpcError) {
        // Handle specific error for already closed shift
        if (rpcError.message?.includes("already closed")) {
          setError("This shift has already been closed by another user.")
        } else {
          setError(rpcError.message || "Failed to close shift")
        }
        return
      }

      setSuccess(true)
      printShiftSummary()
      
      // Notify parent and close dialog after a short delay
      setTimeout(() => {
        onShiftClosed()
        onClose()
      }, 1500)
    } catch (err) {
      setError("An unexpected error occurred while closing the shift")
    } finally {
      setIsClosing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Calculate grand totals
  const grandTotals = summary.reduce(
    (acc, item) => {
      if (item.transaction_type === 1) {
        // Sales
        acc.totalSales += item.total_amount
        acc.totalPayments += item.total_payment
      } else {
        // Expenses
        acc.totalExpenses += item.total_amount
      }
      acc.totalTransactions += item.transaction_count
      return acc
    },
    { totalSales: 0, totalPayments: 0, totalExpenses: 0, totalTransactions: 0 }
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium tracking-wide">Close Shift</DialogTitle>
        </DialogHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <CircleNotch className="w-6 h-6 text-gray-400 animate-spin" />
            <span className="ml-3 text-sm text-gray-500 font-mono">Loading shift summary...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200">
            <WarningCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 font-mono">{error}</p>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700 font-mono">Shift closed and totals recorded successfully!</p>
          </div>
        )}

        {/* Summary Content */}
        {!isLoading && !error && !success && (
          <>
            {/* Grand Totals */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border border-gray-200">
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Total Sales</p>
                <p className="text-lg font-medium">{formatCurrency(grandTotals.totalSales)}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Total Expenses</p>
                <p className="text-lg font-medium text-red-600">{formatCurrency(grandTotals.totalExpenses)}</p>
              </div>
            </div>

            {/* Branch Sections with Payment Type Cards */}
            {summary.length > 0 ? (
              <div className="space-y-6 max-h-80 overflow-auto">
                {/* Group by branch */}
                {Object.entries(
                  summary.reduce((acc, item) => {
                    if (!acc[item.branch_id]) {
                      acc[item.branch_id] = {
                        name: item.branch_name,
                        items: [],
                      }
                    }
                    acc[item.branch_id].items.push(item)
                    return acc
                  }, {} as Record<number, { name: string; items: ShiftTotalsSummary[] }>)
                ).map(([branchId, branch]) => (
                  <div key={branchId}>
                    <h3 className="text-sm font-medium tracking-wide mb-3 border-b border-gray-200 pb-2">
                      {branch.name}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {branch.items.map((item, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between px-4 py-3 border ${
                            item.transaction_type === 2 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
                          }`}
                        >
                          <p className="text-sm font-mono text-gray-700">
                            {item.payment_type_name}
                          </p>
                          <p className={`text-sm font-medium font-mono ${item.transaction_type === 2 ? "text-red-600" : ""}`}>
                            {formatCurrency(item.total_amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-gray-200">
                <p className="text-sm text-gray-400 font-mono">No transactions recorded in this shift</p>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isClosing}
            className="font-mono text-xs tracking-wider"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmClose}
            disabled={isLoading || isClosing || !!error || success}
            className="font-mono text-xs tracking-wider bg-black hover:bg-gray-800"
          >
            {isClosing ? (
              <>
                <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                Closing...
              </>
            ) : (
              "Confirm Close Shift"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
