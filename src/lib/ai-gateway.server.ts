// Server-only AI Gateway — supports Lovable AI Gateway & standard OpenAI-compatible APIs
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createAiProvider(apiKey: string) {
  // If using Lovable AI Gateway
  if (process.env.AI_GATEWAY === "lovable") {
    return createLovableAiGatewayProvider(apiKey);
  }

  // Default: OpenRouter or any OpenAI-compatible endpoint
  const baseURL = process.env.AI_BASE_URL || "https://openrouter.ai/api/v1";

  return createOpenAICompatible({
    name: "ai-provider",
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(process.env.AI_EXTRA_HEADER ? { "HTTP-Referer": process.env.AI_EXTRA_HEADER } : {}),
    },
  });
}

function createLovableAiGatewayProvider(lovableApiKey: string, initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has("X-Lovable-AIG-Run-ID")) {
        headers.set("X-Lovable-AIG-Run-ID", runId);
      }
      const response = await fetch(input, { ...init, headers });
      const next = response.headers.get("X-Lovable-AIG-Run-ID")?.trim();
      if (!runId && next) runId = next;
      return response;
    },
  });

  return provider;
}
