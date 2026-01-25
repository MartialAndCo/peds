"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
    HTMLButtonElement,
    {
        className?: string
        checked?: boolean
        onCheckedChange?: (checked: boolean) => void
        disabled?: boolean
        id?: string
    } & React.ComponentPropsWithoutRef<"button">
>(({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        ref={ref}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
            "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
            className
        )}
        {...props}
    >
        <span className={cn("flex items-center justify-center text-current", !checked && "opacity-0")}>
            <Check className="h-4 w-4" />
        </span>
    </button>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
