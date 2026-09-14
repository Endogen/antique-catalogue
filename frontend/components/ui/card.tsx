import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-3xl border shadow-sm", {
  variants: {
    tone: {
      default: "border-border bg-card/90",
      subtle: "border-border bg-card/80",
      destructive: "border-destructive-border bg-destructive-muted/80",
      brand: "border-brand-border bg-brand-muted/80"
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8"
    }
  },
  defaultVariants: {
    tone: "default",
    padding: "md"
  }
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ tone, padding }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const emptyStateVariants = cva(
  "rounded-3xl border border-dashed border-border bg-card/80 text-sm text-muted-foreground",
  {
    variants: {
      size: {
        sm: "rounded-2xl p-6",
        md: "p-8"
      }
    },
    defaultVariants: {
      size: "md"
    }
  }
);

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {}

/** Dashed placeholder used wherever a list or gallery has nothing to show yet. */
export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(emptyStateVariants({ size }), className)}
      {...props}
    />
  )
);
EmptyState.displayName = "EmptyState";
