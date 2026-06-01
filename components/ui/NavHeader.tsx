"use client";

import { useState } from "react";

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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className={`sticky top-0 z-10 ${variantClasses[variant]} ${className}`} style={style}>
      {/* Main bar */}
      <div className="relative flex items-center px-4 py-3">
        <div className="flex items-center gap-3 flex-1">{left}</div>
        {center && (
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 hidden md:flex items-stretch">
            {center}
          </div>
        )}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="hidden md:flex items-center gap-2">{right}</div>
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M2 2l12 12M14 2L2 14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M2 4h12M2 8h12M2 12h12" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden flex flex-col border-t border-white/10" onClick={() => setMobileOpen(false)}>
          {center && (
            <div className="overflow-x-auto border-b border-white/10">
              <div className="flex h-12">
                {center}
              </div>
            </div>
          )}
          {right && (
            <div className="flex items-center gap-2 px-4 py-3">
              {right}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
