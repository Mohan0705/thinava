import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("thinava-shimmer rounded-xl", className)}
      {...props}
    />
  )
}

export { Skeleton }
