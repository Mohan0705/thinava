import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "mobile-safe-input flex h-12 w-full appearance-none rounded-xl border border-thinava-border bg-white px-4 py-3 text-base leading-tight text-thinava-text ring-offset-white transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 placeholder:opacity-100 focus-visible:border-thinava-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-thinava-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
