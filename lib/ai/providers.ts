import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LlmProvider } from "@/lib/schema/exercise";
import { resolveProvider } from "@/lib/ai/provider-config";

export async function getLanguageModel(provider?: LlmProvider) {
  const resolved = await resolveProvider(provider);
  const selected = resolved.id;

  switch (selected) {
    case "anthropic": {
      if (!resolved.apiKey) {
        throw new Error("Anthropic API key is not configured (portal or ANTHROPIC_API_KEY)");
      }
      const anthropic = createAnthropic({ apiKey: resolved.apiKey });
      return anthropic(resolved.model ?? "claude-sonnet-4-5");
    }
    case "github": {
      if (!resolved.apiKey) {
        throw new Error("GitHub token is not configured (portal or GITHUB_TOKEN)");
      }
      const github = createOpenAICompatible({
        name: "github-models",
        apiKey: resolved.apiKey,
        baseURL: "https://models.github.ai/inference",
      });
      return github(resolved.model ?? "openai/gpt-4.1");
    }
    case "ollama": {
      const ollama = createOpenAICompatible({
        name: "ollama",
        apiKey: "ollama",
        baseURL: resolved.baseURL ?? "http://localhost:11434/v1",
      });
      return ollama(resolved.model ?? "llama3.1");
    }
    case "cursor": {
      if (!resolved.baseURL) {
        throw new Error(
          "Cursor SDK mode is selected without a proxy base URL — use generateObjectWithCursor instead",
        );
      }
      if (!resolved.apiKey) {
        throw new Error("Cursor API key is not configured (portal or CURSOR_API_KEY)");
      }
      const cursor = createOpenAICompatible({
        name: "cursor",
        apiKey: resolved.apiKey,
        baseURL: resolved.baseURL,
      });
      return cursor(resolved.model ?? "composer-2.5");
    }
    case "gemini": {
      if (!resolved.apiKey) {
        throw new Error(
          "Gemini API key is not configured (portal or GOOGLE_GENERATIVE_AI_API_KEY)",
        );
      }
      const google = createGoogleGenerativeAI({ apiKey: resolved.apiKey });
      return google(resolved.model ?? "gemini-2.5-flash");
    }
    case "openai":
    default: {
      if (!resolved.apiKey) {
        throw new Error("OpenAI API key is not configured (portal or OPENAI_API_KEY)");
      }
      const openai = createOpenAI({ apiKey: resolved.apiKey });
      return openai(resolved.model ?? "gpt-4.1");
    }
  }
}
