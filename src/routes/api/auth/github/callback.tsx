import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

const searchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const Route = createFileRoute("/api/auth/github/callback")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Signing in — GuardAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GithubCallbackPage,
});

function GithubCallbackPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const search = Route.useSearch();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (search.error) {
      setStatus("error");
      setErrorMsg(search.error_description || "GitHub authorization was denied.");
      return;
    }

    if (!search.code) {
      setStatus("error");
      setErrorMsg("No authorization code received from GitHub.");
      return;
    }

    (async () => {
      try {
        const { handleGithubCallback } = await import("@/lib/auth.functions");
        const result = await handleGithubCallback({
          data: { code: search.code!, state: search.state || "" },
        });
        signIn(result.token);
        setStatus("success");
        setTimeout(() => {
          navigate({ to: "/dashboard", replace: true });
        }, 500);
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "GitHub sign-in failed.");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-hero)] px-4">
      <div className="text-center">
        {status === "processing" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-lg font-medium">Signing you in...</p>
            <p className="mt-1 text-sm text-muted-foreground">Completing authentication with GitHub.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-medium">Signed in successfully!</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to dashboard...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-medium">Sign-in failed</p>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="mt-4 text-sm font-medium text-primary hover:underline"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
