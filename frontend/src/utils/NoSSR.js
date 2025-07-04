// utils/NoSSR.js
"use client"

import { useEffect, useState } from 'react'

export default function NoSSR({ children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render anything on server or during initial client render
  // This prevents the hydration mismatch
  if (!mounted) {
    return null
  }

  // Only render children after component has mounted on client
  return children
}