import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireAuth } from "./auth.functions";
import { checkRateLimit } from "./rate-limit";
import { query, queryOne } from "./db";

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
  qualityScore: number;
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

// ============ Review Code (AI-driven) ============

export const reviewCode = createServerFn({ method: "POST" })
  .validator((d: unknown) => inputSchema.parse(d))
  .middleware([requireAuth])
  .handler(async ({ data, context }): Promise<ReviewResult> => {
    const apiKey = process.env.LOVABLE_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured.");

    // Rate limiting
    const rateCheck = checkRateLimit(context.userId, "reviewCode");
    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
      throw new Error(
        `Rate limit exceeded. Coba lagi dalam ${retryAfter} detik. (${rateCheck.remaining} tersisa)`
      );
    }

    const { createAiProvider } = await import("./ai-gateway.server");
    const gateway = createAiProvider(apiKey);
    const model = gateway("deepseek-chat");

    const system = `You are GuardAI, a senior software engineer reviewing AI-generated code.
You return ONLY valid JSON matching this TypeScript shape (no markdown, no commentary):
{
  "summary": string,
  "qualityScore": number,
  "findings": Array<{
    "line": number | null,
    "severity": "critical"|"high"|"medium"|"low"|"info",
    "title": string,
    "description": string,
    "suggestion": string
  }>,
  "security": Array<{
    "line": number | null,
    "severity": "critical"|"high"|"medium"|"low"|"info",
    "title": string,
    "description": string,
    "suggestion": string
  }>,
  "tests": string
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

// ============ Review history (PostgreSQL) ============

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
  .middleware([requireAuth])
  .validator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO reviews (user_id, title, language, framework, code, quality_score, findings_count, security_issues_count, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        context.userId,
        data.title,
        data.language,
        data.framework || null,
        data.code,
        Math.round(data.result.qualityScore),
        data.result.findings.length,
        data.result.security.length,
        JSON.stringify(data.result),
      ]
    );
    return { id: row!.id };
  });

export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { rows } = await query(
      `SELECT id, title, language, framework, quality_score, findings_count, security_issues_count, created_at
       FROM reviews
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [context.userId]
    );
    return rows;
  });

export const getReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const row = await queryOne(
      `SELECT * FROM reviews WHERE id = $1 AND user_id = $2`,
      [data.id, context.userId]
    );
    if (!row) throw new Error("Not found");
    return row;
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { rowCount } = await query(
      `DELETE FROM reviews WHERE id = $1 AND user_id = $2`,
      [data.id, context.userId]
    );
    if (rowCount === 0) throw new Error("Not found or unauthorized");
    return { ok: true };
  });
