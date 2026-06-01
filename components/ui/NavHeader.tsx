type Variant = "brand" | "dark";

interface NavHeaderProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  variant?: Variant;
  className?: string;
  style?: React.CSSProperties;
}

const variantClasses: Record<Variant, string> = {
  brand: "bg-brand-800 border-b border-brand-700",
  dark:  "bg-surface-deep border-b border-white/10",
};

export function NavHeader({ left, center, right, variant = "brand", className = "", style }: NavHeaderProps) {
  return (
    <header className={`sticky top-0 z-10 relative flex items-center px-4 py-3 ${variantClasses[variant]} ${className}`} style={style}>
      <div className="flex items-center gap-3 flex-1">{left}</div>
      {center && (
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-stretch">
          {center}
        </div>
      )}
      <div className="flex items-center gap-2 flex-1 justify-end">{right}</div>
    </header>
  );
}
