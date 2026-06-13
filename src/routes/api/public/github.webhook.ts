import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-hub-signature-256");
        const event = request.headers.get("x-github-event") || "";
        const delivery = request.headers.get("x-github-delivery") || "";

        const { verifyWebhookSignature, ghFetch } = await import("@/lib/github.server");
        const ok = await verifyWebhookSignature(rawBody, signature);
        if (!ok) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        try {
          if (event === "installation" || event === "installation_repositories") {
            await handleInstallationEvent(payload);
            return Response.json({ ok: true, event, delivery });
          }

          if (event === "pull_request") {
            const action = payload.action as string;
            if (!["opened", "synchronize", "reopened"].includes(action)) {
              return Response.json({ ok: true, skipped: action });
            }
            await handlePullRequest(payload, ghFetch);
            return Response.json({ ok: true, event, action, delivery });
          }

          return Response.json({ ok: true, ignored: event });
        } catch (err) {
          console.error("[gh-webhook] error", err);
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});

async function handleInstallationEvent(payload: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const action = payload.action as string;
  const installationId = payload.installation?.id as number | undefined;
  if (!installationId) return;

  if (action === "deleted") {
    await supabaseAdmin.from("github_installations").delete().eq("installation_id", installationId);
    return;
  }

  // Update cached repo list when added/removed
  const { listInstallationRepos } = await import("@/lib/github.server");
  try {
    const repos = await listInstallationRepos(installationId);
    await supabaseAdmin
      .from("github_installations")
      .update({ repositories: repos })
      .eq("installation_id", installationId);
  } catch (e) {
    console.warn("[gh-webhook] could not refresh repos", e);
  }
}

const REVIEWABLE_EXT = /\.(ts|tsx|js|jsx|py|go|rb|php|java|kt|swift|rs|cs|vue|svelte|sql)$/i;
const MAX_FILES = 10;
const MAX_BYTES_PER_FILE = 20_000;
const MAX_TOTAL_BYTES = 80_000;

async function handlePullRequest(payload: any, ghFetch: (i: number, p: string, init?: RequestInit) => Promise<Response>) {
  const installationId = payload.installation?.id as number;
  const repo = payload.repository?.full_name as string;
  const pr = payload.pull_request;
  if (!installationId || !repo || !pr) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Insert pending record
  const { data: pending, error: insErr } = await supabaseAdmin
    .from("pr_reviews")
    .insert({
      installation_id: installationId,
      repo_full_name: repo,
      pr_number: pr.number,
      pr_title: pr.title || `PR #${pr.number}`,
      pr_url: pr.html_url,
      commit_sha: pr.head?.sha || "",
      status: "running",
    })
    .select("id")
    .single();
  if (insErr) {
    console.error("[gh-webhook] insert pending failed", insErr);
    return;
  }

  // Fetch changed files
  const filesRes = await ghFetch(installationId, `/repos/${repo}/pulls/${pr.number}/files?per_page=100`);
  if (!filesRes.ok) {
    await supabaseAdmin.from("pr_reviews").update({ status: "failed" }).eq("id", pending.id);
    return;
  }
  const files = (await filesRes.json()) as Array<{
    filename: string;
    status: string;
    patch?: string;
    raw_url?: string;
    contents_url?: string;
  }>;

  const relevant = files
    .filter((f) => REVIEWABLE_EXT.test(f.filename) && f.status !== "removed" && f.patch)
    .slice(0, MAX_FILES);

  if (relevant.length === 0) {
    await supabaseAdmin
      .from("pr_reviews")
      .update({ status: "skipped", result: { reason: "No reviewable code changes" } })
      .eq("id", pending.id);
    return;
  }

  let total = 0;
  const chunks: string[] = [];
  for (const f of relevant) {
    const patch = (f.patch || "").slice(0, MAX_BYTES_PER_FILE);
    if (total + patch.length > MAX_TOTAL_BYTES) break;
    total += patch.length;
    chunks.push(`--- File: ${f.filename} ---\n${patch}`);
  }
  const combined = chunks.join("\n\n");
  const language = detectLanguage(relevant[0].filename);

  // Run AI review
  const result = await runAiReviewOnDiff(combined, language);

  // Post comment to PR
  const commentBody = buildPrComment(result, relevant.map((f) => f.filename));
  let commentId: number | null = null;
  try {
    const cRes = await ghFetch(installationId, `/repos/${repo}/issues/${pr.number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: commentBody }),
    });
    if (cRes.ok) {
      const c = (await cRes.json()) as { id: number };
      commentId = c.id;
    } else {
      console.warn("[gh-webhook] comment post failed", cRes.status, await cRes.text());
    }
  } catch (e) {
    console.warn("[gh-webhook] comment error", e);
  }

  await supabaseAdmin
    .from("pr_reviews")
    .update({
      status: "completed",
      quality_score: result.qualityScore,
      findings_count: result.findings.length,
      security_issues_count: result.security.length,
      result,
      comment_id: commentId,
    })
    .eq("id", pending.id);
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", go: "go", rb: "ruby", php: "php", java: "java",
    kt: "kotlin", swift: "swift", rs: "rust", cs: "csharp",
    vue: "vue", svelte: "svelte", sql: "sql",
  };
  return map[ext] || "plaintext";
}

type AiReview = {
  summary: string;
  qualityScore: number;
  findings: Array<{ line: number | null; severity: string; title: string; description: string; suggestion: string }>;
  security: Array<{ line: number | null; severity: string; title: string; description: string; suggestion: string }>;
  tests: string;
};

async function runAiReviewOnDiff(diffText: string, language: string): Promise<AiReview> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI not configured");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const { generateText } = await import("ai");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-3-flash-preview");

  const system = `You are AI Code Guardian reviewing a Pull Request diff.
Return ONLY valid JSON: { "summary": string, "qualityScore": number (0-100),
"findings": Array<{line:number|null,severity:"critical"|"high"|"medium"|"low"|"info",title:string,description:string,suggestion:string}>,
"security": Array<same shape, OWASP-focused>, "tests": string }.
Be concise, 3-8 findings. Use the "line" within the patch when possible.`;

  const prompt = `Pull request diff (language: ${language}):\n\n${diffText}`;

  const { text } = await generateText({ model, system, prompt });

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fence ? fence[1] : text).trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  const parsed = JSON.parse(raw.slice(first, last + 1)) as Partial<AiReview>;

  return {
    summary: parsed.summary || "",
    qualityScore: Math.max(0, Math.min(100, Math.round(Number(parsed.qualityScore) || 0))),
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    security: Array.isArray(parsed.security) ? parsed.security : [],
    tests: typeof parsed.tests === "string" ? parsed.tests : "",
  };
}

function buildPrComment(r: AiReview, filenames: string[]): string {
  const sev = (s: string) =>
    s === "critical" ? "🔴" : s === "high" ? "🟠" : s === "medium" ? "🟡" : s === "low" ? "🔵" : "⚪";
  const findingsMd = r.findings.length
    ? r.findings
        .map(
          (f) =>
            `- ${sev(f.severity)} **${f.severity.toUpperCase()}** — ${f.title}${f.line != null ? ` _(line ${f.line})_` : ""}\n  ${f.description}${f.suggestion ? `\n  > 💡 ${f.suggestion.split("\n")[0]}` : ""}`,
        )
        .join("\n")
    : "_No findings — clean code._";
  const securityMd = r.security.length
    ? r.security.map((f) => `- ${sev(f.severity)} **${f.title}** — ${f.description}`).join("\n")
    : "_No security issues found._";

  return `## 🛡️ AI Code Guardian Review

**Quality Score: \`${r.qualityScore}/100\`**

${r.summary}

**Files reviewed (${filenames.length}):** ${filenames.map((f) => `\`${f}\``).join(", ")}

### 🔍 Findings (${r.findings.length})
${findingsMd}

### 🔐 Security (${r.security.length})
${securityMd}

---
<sub>Automated by AI Code Guardian · powered by Gemini</sub>`;
}
