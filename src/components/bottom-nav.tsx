import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Shield, GitPullRequest, BookOpen, MoreHorizontal, History, Github, CircleDollarSign, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const MAIN_NAV = [
  { path: "/dashboard", labelKey: "nav.review", Icon: Shield },
  { path: "/pr-reviews", labelKey: "nav.prs", Icon: GitPullRequest },
  { path: "/guidelines", labelKey: "nav.guidelines", Icon: BookOpen },
] as const;

const MORE_ITEMS = [
  { path: "/history", labelKey: "nav.history", Icon: History },
  { path: "/integrations", labelKey: "nav.integrations", Icon: Github },
  { path: "/billing", labelKey: "nav.billing", Icon: CircleDollarSign },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background sm:hidden">
      <div className="flex items-center justify-around py-1">
        {MAIN_NAV.map(({ path, labelKey, Icon }) => {
          const active = pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path as any}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{t(labelKey as any)}</span>
            </Link>
          );
        })}

        {/* More */}
        <div ref={moreRef} className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors ${
              moreOpen || MORE_ITEMS.some((m) => pathname.startsWith(m.path))
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>{t("nav.more")}</span>
          </button>

          {moreOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-44 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
              {MORE_ITEMS.map(({ path, labelKey, Icon }) => {
                const active = pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path as any}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(labelKey as any)}</span>
                  </Link>
                );
              })}
              <hr className="my-1 border-border" />
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span>{t("nav.signout")}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
