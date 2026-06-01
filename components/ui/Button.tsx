import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "ghost-dark";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:     "bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white font-bold",
  secondary:   "bg-white hover:bg-gray-50 disabled:bg-gray-100 text-brand-700 border border-brand-600 font-medium",
  ghost:       "text-brand-400 hover:text-white disabled:text-brand-700 font-medium",
  "ghost-dark":"bg-white/10 hover:bg-white/20 text-white font-medium",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3 text-lg rounded-xl w-full",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, children, className = "", disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? "Loading…" : children}
    </button>
  );
});
