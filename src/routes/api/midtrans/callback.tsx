import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/midtrans/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        let payload: Record<string, any>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response(JSON.stringify({ status: "invalid_payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { handleMidtransCallback } = await import("@/lib/payment.functions");
          const result = await handleMidtransCallback({ data: payload });

          console.log("[midtrans-callback] order=%s status=%s",
            payload.order_id || "?", result.status);

          return new Response(JSON.stringify({ status: result.status }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[midtrans-callback] error:", err);
          return new Response(
            JSON.stringify({ status: "error", message: err instanceof Error ? err.message : "Unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
