import { generateText } from "ai";
import type { LlmProvider } from "@/lib/schema/exercise";
import { resolveProvider } from "@/lib/ai/provider-config";
import { getLanguageModel } from "@/lib/ai/providers";
import { cursorSdkEnabled } from "@/lib/ai/cursor-generate";
import { ollamaDockerHint, runningInDocker } from "@/lib/ai/docker-url";

export type ConnectionTestResult = {
  ok: boolean;
  provider: LlmProvider;
  model: string | null;
  source: "portal" | "env" | "none";
  latencyMs: number;
  message: string;
};

export async function testProviderConnection(
  provider: LlmProvider,
): Promise<ConnectionTestResult> {
  const resolved = await resolveProvider(provider);
  const started = Date.now();

  if (resolved.source === "none") {
    return {
      ok: false,
      provider,
      model: resolved.model ?? null,
      source: resolved.source,
      latencyMs: 0,
      message: "No credentials configured for this provider.",
    };
  }

  // Cursor SDK (no OpenAI-compatible proxy) — key presence only; agents are costly.
  if (provider === "cursor" && (await cursorSdkEnabled())) {
    return {
      ok: true,
      provider,
      model: resolved.model ?? null,
      source: resolved.source,
      latencyMs: Date.now() - started,
      message:
        "Cursor API key present (SDK mode). Live agent probe skipped — run Generate to fully verify.",
    };
  }

  try {
    const model = await getLanguageModel(provider);
    const result = await generateText({
      model,
      prompt: "Reply with exactly the two letters: OK",
      maxOutputTokens: 16,
      temperature: 0,
      maxRetries: 0,
      timeout: 20_000,
    });
    const text = (result.text ?? "").trim().slice(0, 80);
    const latencyMs = Date.now() - started;
    const looksOk = /ok/i.test(text) || text.length > 0;
    const hint =
      provider === "ollama" ? ollamaDockerHint(resolved.baseURL) : null;
    return {
      ok: looksOk,
      provider,
      model: resolved.model ?? null,
      source: resolved.source,
      latencyMs,
      message: looksOk
        ? `Connected (${latencyMs} ms)${text ? ` · ${text}` : ""}${
            hint ? ` · ${hint}` : ""
          }`
        : "Provider responded with an empty body.",
    };
  } catch (error) {
    let message =
      error instanceof Error ? error.message : "Connection test failed";
    if (
      provider === "ollama" &&
      /ECONNREFUSED|ENOTFOUND|fetch failed|connect/i.test(message)
    ) {
      message = runningInDocker()
        ? `${message} — In Docker use Base URL http://host.docker.internal:11434/v1 (not localhost), ensure Ollama is running on the host, and OLLAMA_HOST=0.0.0.0 if needed.`
        : `${message} — Is Ollama running? Try curl http://127.0.0.1:11434/api/tags and set Base URL to http://localhost:11434/v1.`;
    }
    return {
      ok: false,
      provider,
      model: resolved.model ?? null,
      source: resolved.source,
      latencyMs: Date.now() - started,
      message: message.slice(0, 400),
    };
  }
}
