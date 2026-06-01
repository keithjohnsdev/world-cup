type Variant = "brand" | "dark";

interface NavHeaderProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  brand: "bg-brand-800 border-b border-brand-700",
  dark:  "bg-surface-deep border-b border-white/10",
};

export function NavHeader({ left, right, variant = "brand" }: NavHeaderProps) {
  return (
    <header className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 ${variantClasses[variant]}`}>
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}
