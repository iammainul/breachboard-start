import type { LlmProvider } from "@/lib/schema/exercise";
import { resolveProvider } from "@/lib/ai/provider-config";
import { rewriteLoopbackForDocker } from "@/lib/ai/docker-url";

export type ListedModel = {
  id: string;
  label: string;
  description?: string;
};

export type ListModelsResult = {
  ok: boolean;
  provider: LlmProvider;
  models: ListedModel[];
  message: string;
};

function stripModelsPrefix(name: string) {
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

/**
 * Live model catalog for a provider when credentials are available.
 * Pass draftApiKey / draftBaseURL to probe before saving to the portal.
 */
export async function listProviderModels(opts: {
  provider: LlmProvider;
  draftApiKey?: string;
  draftBaseURL?: string;
}): Promise<ListModelsResult> {
  const resolved = await resolveProvider(opts.provider);
  const apiKey = opts.draftApiKey?.trim() || resolved.apiKey;
  const baseURL = rewriteLoopbackForDocker(
    opts.draftBaseURL?.trim() || resolved.baseURL,
  );

  try {
    switch (opts.provider) {
      case "gemini":
        return await listGeminiModels(apiKey);
      case "openai":
        return await listOpenAiModels(apiKey);
      case "ollama":
        return await listOllamaModels(baseURL);
      case "anthropic":
        return {
          ok: Boolean(apiKey),
          provider: "anthropic",
          models: apiKey
            ? [
                { id: "claude-sonnet-4-5", label: "claude-sonnet-4-5" },
                { id: "claude-opus-4-5", label: "claude-opus-4-5" },
                { id: "claude-haiku-4-5", label: "claude-haiku-4-5" },
              ]
            : [],
          message: apiKey
            ? "Suggested Anthropic model ids (API has no public list)."
            : "Paste an Anthropic API key to see suggestions.",
        };
      case "github":
        return {
          ok: Boolean(apiKey),
          provider: "github",
          models: apiKey
            ? [
                { id: "openai/gpt-4.1", label: "openai/gpt-4.1" },
                { id: "openai/gpt-4o", label: "openai/gpt-4o" },
                { id: "openai/gpt-4o-mini", label: "openai/gpt-4o-mini" },
              ]
            : [],
          message: apiKey
            ? "Common GitHub Models ids."
            : "Paste a GitHub token to see suggestions.",
        };
      case "cursor":
        return {
          ok: Boolean(apiKey),
          provider: "cursor",
          models: apiKey
            ? [
                { id: "composer-2.5", label: "composer-2.5" },
                { id: "claude-4.5-sonnet", label: "claude-4.5-sonnet" },
                { id: "gpt-5.2", label: "gpt-5.2" },
              ]
            : [],
          message: apiKey
            ? "Common Cursor model ids."
            : "Paste a Cursor API key to see suggestions.",
        };
      default:
        return {
          ok: false,
          provider: opts.provider,
          models: [],
          message: "Model listing is not supported for this provider.",
        };
    }
  } catch (error) {
    return {
      ok: false,
      provider: opts.provider,
      models: [],
      message:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Could not list models",
    };
  }
}

async function listGeminiModels(apiKey: string | undefined): Promise<ListModelsResult> {
  if (!apiKey) {
    return {
      ok: false,
      provider: "gemini",
      models: [],
      message: "Paste a Google Gemini API key to list models.",
    };
  }

  const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
  url.searchParams.set("pageSize", "100");
  const response = await fetch(url, {
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      provider: "gemini",
      models: [],
      message: `Gemini models API ${response.status}: ${body.slice(0, 200) || response.statusText}`,
    };
  }

  const json = (await response.json()) as {
    models?: {
      name?: string;
      displayName?: string;
      description?: string;
      supportedGenerationMethods?: string[];
    }[];
  };

  const models = (json.models ?? [])
    .filter((m) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent"),
    )
    .map((m) => {
      const id = stripModelsPrefix(m.name ?? "");
      return {
        id,
        label: m.displayName ? `${id} · ${m.displayName}` : id,
        description: m.description?.slice(0, 160),
      };
    })
    .filter((m) => m.id && !m.id.includes("embedding"))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    ok: true,
    provider: "gemini",
    models,
    message:
      models.length > 0
        ? `${models.length} Gemini models available for generateContent`
        : "No generateContent models returned for this key",
  };
}

async function listOpenAiModels(apiKey: string | undefined): Promise<ListModelsResult> {
  if (!apiKey) {
    return {
      ok: false,
      provider: "openai",
      models: [],
      message: "Paste an OpenAI API key to list models.",
    };
  }
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      provider: "openai",
      models: [],
      message: `OpenAI models API ${response.status}: ${body.slice(0, 200) || response.statusText}`,
    };
  }
  const json = (await response.json()) as { data?: { id?: string }[] };
  const models = (json.data ?? [])
    .map((m) => m.id ?? "")
    .filter((id) => /^(gpt-|o[1-9]|chatgpt)/i.test(id))
    .sort()
    .map((id) => ({ id, label: id }));

  return {
    ok: true,
    provider: "openai",
    models,
    message: `${models.length} chat-capable models`,
  };
}

async function listOllamaModels(
  baseURL: string | undefined,
): Promise<ListModelsResult> {
  const base = (baseURL ?? "http://localhost:11434/v1").replace(/\/v1\/?$/, "");
  const response = await fetch(`${base}/api/tags`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    return {
      ok: false,
      provider: "ollama",
      models: [],
      message: `Ollama tags ${response.status}: is Ollama running at ${base}?`,
    };
  }
  const json = (await response.json()) as {
    models?: { name?: string; model?: string }[];
  };
  const models = (json.models ?? [])
    .map((m) => m.name || m.model || "")
    .filter(Boolean)
    .sort()
    .map((id) => ({ id, label: id }));

  return {
    ok: true,
    provider: "ollama",
    models,
    message: `${models.length} local Ollama models`,
  };
}
