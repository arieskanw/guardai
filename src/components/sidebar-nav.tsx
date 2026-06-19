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
  User,
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
      <div className="border-t border-border p-3">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <User className="h-5 w-5" />
          <div className="flex-1 truncate">
            <span className="block">{t("nav.profile")}</span>
            <span className="block truncate text-xs text-muted-foreground/70" title={user?.email ? user.email : undefined}>
              {user?.email}
            </span>
          </div>
        </Link>
        <div className="mt-1 flex items-center justify-end px-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("nav.signout")}
          </button>
        </div>
      </div>
    </aside>
  );
}
