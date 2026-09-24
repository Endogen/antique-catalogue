import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared field chrome. Kept in one place so focus/disabled/invalid states stay
 * identical across every form in the app.
 */
export const fieldClassName =
  "w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground shadow-xs transition placeholder:text-muted-foreground/70 focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted aria-invalid:border-destructive-border aria-invalid:focus:ring-destructive-border";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldClassName, className)} {...props} />
  )
);
Input.displayName = "Input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      // Grows with its content where field-sizing is supported; `rows` still
      // sets the height everywhere else.
      className={cn(fieldClassName, "field-sizing-content min-h-28 max-h-[60vh]", className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(fieldClassName, className)} {...props} />
  )
);
Select.displayName = "Select";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";
