import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { FIELD_CLASS } from "./input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(FIELD_CLASS, "h-10", className)} {...props} />;
  },
);
