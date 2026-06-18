import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  Shield,
  GitPullRequest,
  BookOpen,
  History,
  Github,
  CircleDollarSign,
  LogOut,
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { path: "/dashboard", labelKey: "nav.review", Icon: Shield },
  { path: "/pr-reviews", labelKey: "nav.prs", Icon: GitPullRequest },
  { path: "/guidelines", labelKey: "nav.guidelines", Icon: BookOpen },
  { path: "/history", labelKey: "nav.history", Icon: History },
  { path: "/integrations", labelKey: "nav.integrations", Icon: Github },
  { path: "/billing", labelKey: "nav.billing", Icon: CircleDollarSign },
];

export function SidebarNav() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <aside className="hidden sm:flex sm:flex-col sm:w-64 sm:fixed sm:inset-y-0 sm:border-r sm:border-border sm:bg-background sm:z-40">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Shield className="h-5 w-5" />
        </span>
        <span className="text-base font-semibold tracking-tight">
          GuardAI
        </span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {SIDEBAR_ITEMS.map(({ path, labelKey, Icon }) => {
          const active = pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path as any}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{t(labelKey as any)}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-border p-4">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-muted-foreground" title={user?.email}>
            {user?.email}
          </span>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
            title={t("nav.signout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
