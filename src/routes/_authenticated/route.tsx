import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { BottomNav } from "@/components/bottom-nav";
import { SidebarNav } from "@/components/sidebar-nav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("guardai_auth_token") : null;
    if (!token) throw redirect({ to: "/auth" });

    try {
      const { getMe } = await import("@/lib/auth.functions");
      const user = await getMe({ headers: { Authorization: `Bearer ${token}` } });
      if (!user) throw new Error("No user");
      return { user };
    } catch {
      localStorage.removeItem("guardai_auth_token");
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop only */}
      <SidebarNav />

      {/* Main content — offset by sidebar width on desktop */}
      <main className="flex-1 sm:ml-64 pb-16 sm:pb-0">
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  ),
});
