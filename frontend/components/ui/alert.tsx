import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "rounded-2xl border px-4 py-3 text-sm",
  {
    variants: {
      tone: {
        error: "border-destructive-border bg-destructive-muted text-destructive",
        success: "border-success-border bg-success-muted text-success",
        info: "border-border bg-muted text-muted-foreground",
        brand: "border-brand-border bg-brand-muted text-brand"
      }
    },
    defaultVariants: {
      tone: "error"
    }
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

/**
 * Inline status banner. Errors announce assertively, everything else politely,
 * unless the caller overrides `role`.
 */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, tone = "error", role, ...props }, ref) => (
    <div
      ref={ref}
      role={role ?? (tone === "error" ? "alert" : "status")}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  )
);
Alert.displayName = "Alert";
