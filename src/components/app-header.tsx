import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import type { ReactNode } from "react";

interface AppHeaderProps {
  /** Optional left-side content — overrides the default brand logo + name */
  leftSlot?: ReactNode;
  /** Right-side nav items — shown inline on desktop, hidden on mobile (BottomNav handles mobile) */
  children?: ReactNode;
  /** User email — shown on desktop beside nav items */
  userEmail?: string | null;
}

export function AppHeader({ leftSlot, children, userEmail }: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left — brand or custom */}
        {leftSlot ?? (
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
              <Shield className="h-5 w-5" />
            </span>
            <span className="truncate text-base font-semibold tracking-tight">
              GuardAI
            </span>
          </Link>
        )}

        {/* Desktop nav — hidden on mobile (BottomNav handles mobile) */}
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {userEmail && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {userEmail}
            </span>
          )}
          {children}
        </div>
      </div>
    </header>
  );
}
