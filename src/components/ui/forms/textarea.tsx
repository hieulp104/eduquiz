import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { FIELD_CLASS } from "./input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD_CLASS, "min-h-20 py-2", className)} {...props} />;
  },
);
