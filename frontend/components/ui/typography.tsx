import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The small letter-spaced label that sits above almost every heading in the app.
 */
const eyebrowVariants = cva("text-xs uppercase", {
  variants: {
    tone: {
      muted: "text-muted-foreground",
      subtle: "text-muted-foreground/70",
      brand: "text-brand"
    },
    spacing: {
      tight: "tracking-[0.2em]",
      normal: "tracking-[0.3em]",
      wide: "tracking-[0.4em]"
    }
  },
  defaultVariants: {
    tone: "muted",
    spacing: "normal"
  }
});

export interface EyebrowProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof eyebrowVariants> {
  asChild?: boolean;
}

export const Eyebrow = React.forwardRef<HTMLParagraphElement, EyebrowProps>(
  ({ className, tone, spacing, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(eyebrowVariants({ tone, spacing }), className)}
      {...props}
    />
  )
);
Eyebrow.displayName = "Eyebrow";

const headingVariants = cva("font-display text-foreground", {
  variants: {
    size: {
      md: "text-xl",
      lg: "text-2xl",
      xl: "text-3xl",
      "2xl": "text-4xl"
    }
  },
  defaultVariants: {
    size: "lg"
  }
});

export interface SectionHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4";
}

export const SectionHeading = React.forwardRef<
  HTMLHeadingElement,
  SectionHeadingProps
>(({ className, size, as: Tag = "h2", ...props }, ref) => (
  <Tag
    ref={ref}
    className={cn(headingVariants({ size }), className)}
    {...props}
  />
));
SectionHeading.displayName = "SectionHeading";
