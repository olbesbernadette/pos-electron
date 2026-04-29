"use client"

import { useState, useRef, useEffect } from "react"
import { Money, Wallet, Wrench, Lightning, Anchor, DotsThree, X, WarningCircle } from "@phosphor-icons/react"
import { useShift } from "@/contexts/shift-context"
import { createClient } from "@/lib/supabase/client"

// Generate UUID for idempotency
const generateIdempotencyKey = (): string => {
  return crypto.randomUUID()
}

const expenseCategories = [
  { id: 5, key: "payroll", label: "Payroll", icon: Wallet },
  { id: 6, key: "deposit", label: "Deposit", icon: Money },
  { id: 7, key: "repairs", label: "Repairs", icon: Wrench },
  { id: 8, key: "utilities", label: "Utilities", icon: Lightning },
  { id: 9, key: "port-fees", label: "Port Fees", icon: Anchor },
  { id: 10, key: "others", label: "Others", icon: DotsThree },
]

// Format number with commas and 2 decimal places
const formatCurrency = (value: string): string => {
  const numericValue = value.replace(/[^0-9.]/g, "")
  
  if (!numericValue) return ""
  
  const parts = numericValue.split(".")
  let integerPart = parts[0]
  const decimalPart = parts[1]
  
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  
  if (decimalPart !== undefined) {
    return `${integerPart}.${decimalPart.slice(0, 2)}`
  }
  
  return integerPart
}

// Parse formatted currency back to raw number string
const parseCurrency = (value: string): string => {
  return value.replace(/,/g, "")
}

interface ExpensesFormProps {
  branchName: string
  branchId: number
}

export function ExpensesForm({ branchName, branchId }: ExpensesFormProps) {
  const { currentShiftId, hasOpenShift, isLoading: shiftLoading } = useShift()
  const [selectedCategory, setSelectedCategory] = useState<number>(5)
  const [description, setDescription] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  
  // Idempotency key for preventing duplicate submissions
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey())
  const amountRef = useRef<HTMLInputElement>(null)
  const maxRetries = 3
  
  // Auto-focus amount on mount
  useEffect(() => {
    if (amountRef.current && hasOpenShift && !shiftLoading) {
      amountRef.current.focus()
    }
  }, [hasOpenShift, shiftLoading])

  const handleCurrencyChange = (value: string) => {
    const formatted = formatCurrency(value)
    setAmount(formatted)
  }

  const resetForm = () => {
    setDescription("")
    setAmount("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!hasOpenShift || !currentShiftId) {
      return
    }

    // Prevent double-clicks
    if (isSubmitting) {
      return
    }

    if (!amount || parseFloat(parseCurrency(amount)) <= 0) {
      setSubmitError("Please enter a valid amount.")
      return
    }

    setIsSubmitting(true)
    setSubmitSuccess(false)
    setSubmitError(null)

    const supabase = createClient()
    const expenseAmount = parseFloat(parseCurrency(amount)) || 0
    const currentIdempotencyKey = idempotencyKeyRef.current

    // Retry logic for network failures
    let success = false

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // transaction_type: 2 = expenses
      // details1 = description
      const { error: transactionError } = await supabase
        .from("shift_transactions")
        .insert({
          shift_id: currentShiftId,
          transaction_type: 2,
          branch_id: branchId,
          payment_type: selectedCategory,
          amount: expenseAmount,
          payment_amount: 0,
          idempotency_key: currentIdempotencyKey,
          details1: description || null,
        })

      if (!transactionError) {
        success = true
        break
      }

      // Check if it's a duplicate key error (transaction already exists)
      if (transactionError?.code === "23505") {
        // Duplicate idempotency key - transaction was already recorded
        success = true
        break
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100))
      }
    }

    if (!success) {
      setIsSubmitting(false)
      setSubmitError("Failed to record expense. Please try again.")
      return
    }

    setIsSubmitting(false)
setSubmitSuccess(true)
  resetForm()
  // Generate new idempotency key for next submission
  idempotencyKeyRef.current = generateIdempotencyKey()
  setTimeout(() => setSubmitSuccess(false), 3000)
  // Focus amount for next entry
  setTimeout(() => amountRef.current?.focus(), 100)
  }

  const isFormDisabled = !hasOpenShift || shiftLoading

  // Handle Enter key to move to next field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldId?: string) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (nextFieldId) {
        const nextField = document.getElementById(nextFieldId)
        nextField?.focus()
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 p-6 overflow-hidden max-w-full">
      {/* No Shift Warning */}
      {!shiftLoading && !hasOpenShift && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-center gap-3">
          <WarningCircle className="w-5 h-5 text-red-600 flex-shrink-0" weight="fill" />
          <p className="text-sm text-red-700 font-mono tracking-wide">
            Open a new shift to record expenses
          </p>
        </div>
      )}

      {/* Success Message */}
      {submitSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200">
          <p className="text-sm text-green-700 font-mono tracking-wide">
            Expense recorded successfully
          </p>
        </div>
      )}

      {/* Error Message */}
      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-center gap-3">
          <WarningCircle className="w-5 h-5 text-red-600 flex-shrink-0" weight="fill" />
          <p className="text-sm text-red-700 font-mono tracking-wide">
            {submitError}
          </p>
        </div>
      )}

      {/* Expenses Label */}
      <h2 className="text-lg font-medium tracking-wide mb-6">Expense</h2>

      {/* Category Options */}
      <div className="mb-6">
        <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-3">
          Category
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {expenseCategories.map((category) => {
            const Icon = category.icon
            const isSelected = selectedCategory === category.id
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`flex flex-col items-center justify-center p-4 border transition-all ${
                  isSelected
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                }`}
              >
                <Icon className="w-6 h-6 mb-2" weight={isSelected ? "fill" : "regular"} />
                <span className="text-xs font-mono tracking-wider">{category.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
          Description
        </label>
        <div className="relative">
          <input
            id="expense-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, "expense-amount")}
            placeholder="Enter expense description"
            className="w-full px-4 pr-10 py-3 border border-gray-200 font-mono focus:outline-none focus:border-black transition-colors"
          />
          {description && (
            <button
              type="button"
              onClick={() => setDescription("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="mb-6">
        <label className="block text-xs text-gray-500 font-mono tracking-wider uppercase mb-2">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">
            PHP
          </span>
<input
                ref={amountRef}
                id="expense-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e)}
            placeholder="0.00"
            className="w-full pl-14 pr-10 py-3 border border-gray-200 font-mono text-right text-lg focus:outline-none focus:border-black transition-colors"
          />
          {amount && (
            <button
              type="button"
              onClick={() => setAmount("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isFormDisabled || isSubmitting}
        className={`w-full py-3 font-mono tracking-wider uppercase text-sm transition-colors ${
          isFormDisabled
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        {isSubmitting ? "Recording..." : "Record Expense"}
      </button>
    </form>
  )
}
