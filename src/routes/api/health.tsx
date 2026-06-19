import { createFileRoute } from "@tanstack/react-router";

const START_TIME = Date.now();

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const uptimeMs = Date.now() - START_TIME;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);

        let dbStatus = "ok";
        let dbError: string | null = null;

        try {
          const { query } = await import("@/lib/db");
          await query("SELECT 1");
        } catch (err) {
          dbStatus = "error";
          dbError = err instanceof Error ? err.message : "Unknown DB error";
        }

        const status = dbStatus === "ok" ? "ok" : "degraded";

        return new Response(
          JSON.stringify({
            status,
            timestamp: new Date().toISOString(),
            uptime: {
              seconds: uptimeSeconds,
              human: formatUptime(uptimeSeconds),
            },
            database: {
              status: dbStatus,
              error: dbError,
            },
            version: "1.0.0",
          }),
          {
            status: status === "ok" ? 200 : 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, max-age=0",
            },
          }
        );
      },
    },
  },
});

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}
