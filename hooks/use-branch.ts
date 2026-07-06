"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface Branch {
  id: number
  name: string
}

const slugify = (name: string) => name.toLowerCase().replace(/\s+/g, "-")

export function useBranch(slug: string) {
  const [branch, setBranch] = useState<Branch | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchBranch = async () => {
      setIsLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")

      if (!cancelled) {
        const match = !error && data ? data.find(b => slugify(b.name) === slug) : null
        setBranch(match ?? null)
        setIsLoading(false)
      }
    }

    fetchBranch()
    return () => {
      cancelled = true
    }
  }, [slug])

  return { branch, isLoading }
}
