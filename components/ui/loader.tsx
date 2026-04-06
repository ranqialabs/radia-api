"use client"

import { DotSpinner } from "ldrs/react"
import "ldrs/react/DotSpinner.css"
import { Hourglass } from "ldrs/react"
import "ldrs/react/Hourglass.css"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

function useLoaderColor() {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === "dark" ? "white" : "black"
}

interface SpinnerProps {
  size?: number
  className?: string
}

export function Spinner({ size = 18, className }: SpinnerProps) {
  const color = useLoaderColor()
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      <DotSpinner size={size} speed="0.9" color={color} />
    </span>
  )
}

interface LoaderProps {
  size?: number
  className?: string
}

/** Hourglass loader, use in overlays, empty states and full-page loading */
export function Loader({ size = 44, className }: LoaderProps) {
  const color = useLoaderColor()
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      <Hourglass size={size} bgOpacity={0.1} speed={1.75} color={color} />
    </span>
  )
}
