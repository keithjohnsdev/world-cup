type Variant = "default" | "dark";

interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-surface-card rounded-2xl shadow-sm border border-gray-100",
  dark:    "bg-surface-dark/95 backdrop-blur rounded-2xl border border-brand-500/40 shadow-2xl",
};

export function Card({ children, variant = "default", className = "" }: CardProps) {
  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
