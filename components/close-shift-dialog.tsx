"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { WarningCircle, CheckCircle, CircleNotch } from "@phosphor-icons/react"
import { createClient } from "@/lib/supabase/client"

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

  // Fetch shift summary when dialog opens
  useEffect(() => {
    if (isOpen && shiftId) {
      fetchShiftSummary()
    } else {
      // Reset state when dialog closes
      setSummary([])
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
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
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
