import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-thinava-primary/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 thinava-touch",
  {
    variants: {
      variant: {
        default:
          "thinava-gradient-bg text-white shadow-md shadow-thinava-primary/20 hover:brightness-105",
        destructive: "bg-thinava-error text-white hover:bg-red-600",
        outline:
          "border border-thinava-border bg-white text-thinava-text hover:bg-thinava-bg",
        secondary: "bg-gray-100 text-thinava-text hover:bg-gray-200",
        ghost: "text-thinava-text hover:bg-thinava-bg",
        link: "text-thinava-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
