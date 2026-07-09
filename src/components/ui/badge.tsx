import { cn } from "@/lib/utils";

const variants = {
  default: "border-zinc-700 bg-zinc-900 text-zinc-200",
  danger: "border-red-900/60 bg-red-950/60 text-red-200",
  warning: "border-amber-900/60 bg-amber-950/60 text-amber-200",
  success: "border-emerald-900/60 bg-emerald-950/60 text-emerald-200",
  info: "border-sky-900/60 bg-sky-950/60 text-sky-200",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
