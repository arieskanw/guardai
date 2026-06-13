import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type ReviewFinding = {
  line: number | null;
  severity: Severity;
  title: string;
  description: string;
  suggestion: string;
};

export type ReviewResult = {
  summary: string;
  qualityScore: number; // 0..100
  findings: ReviewFinding[];
  tests: string;
  security: ReviewFinding[];
};

const inputSchema = z.object({
  code: z.string().min(10).max(50_000),
  language: z.string().min(1).max(40),
  framework: z.string().max(80).optional().default(""),
  guidelines: z.string().max(8000).optional().default(""),
});

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fence ? fence[1] : text).trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("No JSON found in model response");
  return JSON.parse(raw.slice(first, last + 1));
}

export const reviewCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<ReviewResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured.");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are AI Code Guardian, a senior software engineer reviewing AI-generated code.
You return ONLY valid JSON matching this TypeScript shape (no markdown, no commentary):
{
  "summary": string,                 // 2-3 concise sentences
  "qualityScore": number,            // integer 0-100
  "findings": Array<{
    "line": number | null,
    "severity": "critical"|"high"|"medium"|"low"|"info",
    "title": string,
    "description": string,
    "suggestion": string              // actionable, short code snippet allowed
  }>,
  "security": Array<{                 // OWASP-style security findings only
    "line": number | null,
    "severity": "critical"|"high"|"medium"|"low"|"info",
    "title": string,
    "description": string,
    "suggestion": string
  }>,
  "tests": string                     // generated unit/integration tests as a code block in the same language
}
Rules:
- Be concise and high-signal. Skip nitpicks unless severity warrants it.
- Prefer 3-8 findings. Empty array is allowed if code is genuinely clean.
- "tests" should be runnable test code matching the language/framework when possible.`;

    const prompt = `Language: ${data.language}
Framework: ${data.framework || "(unspecified)"}
${data.guidelines ? `Team guidelines:\n${data.guidelines}\n` : ""}
Code to review:
\`\`\`${data.language}
${data.code}
\`\`\``;

    const { text } = await generateText({
      model,
      system,
      prompt,
    });

    const parsed = extractJson(text) as Partial<ReviewResult>;

    const finding = z.object({
      line: z.number().nullable().catch(null),
      severity: z.enum(["critical", "high", "medium", "low", "info"]).catch("info"),
      title: z.string(),
      description: z.string(),
      suggestion: z.string().default(""),
    });

    const result: ReviewResult = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      qualityScore: Math.max(0, Math.min(100, Math.round(Number(parsed.qualityScore) || 0))),
      findings: Array.isArray(parsed.findings)
        ? parsed.findings.map((f) => finding.parse(f))
        : [],
      security: Array.isArray(parsed.security)
        ? parsed.security.map((f) => finding.parse(f))
        : [],
      tests: typeof parsed.tests === "string" ? parsed.tests : "",
    };

    return result;
  });

// ============ Review history (DB-backed) ============

const saveSchema = z.object({
  title: z.string().min(1).max(200),
  language: z.string().min(1).max(40),
  framework: z.string().max(80).optional().default(""),
  code: z.string().min(1).max(50_000),
  result: z.object({
    summary: z.string(),
    qualityScore: z.number(),
    findings: z.array(z.any()),
    security: z.array(z.any()),
    tests: z.string(),
  }),
});

export const saveReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("reviews")
      .insert({
        user_id: userId,
        title: data.title,
        language: data.language,
        framework: data.framework || null,
        code: data.code,
        quality_score: Math.round(data.result.qualityScore),
        findings_count: data.result.findings.length,
        security_issues_count: data.result.security.length,
        result: data.result,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reviews")
      .select("id,title,language,framework,quality_score,findings_count,security_issues_count,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reviews")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
