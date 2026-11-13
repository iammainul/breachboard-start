import { z } from "zod";
import type { LlmProvider } from "@/lib/schema/exercise";
import { llmProviderSchema } from "@/lib/schema/exercise";
import {
  getAppSetting,
  setAppSetting,
  SETTING_AI_PROVIDERS,
} from "@/lib/app-settings";
import { rewriteLoopbackForDocker } from "@/lib/ai/docker-url";

export { SETTING_AI_PROVIDERS };

const providerEntrySchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseURL: z.string().optional(),
});

export const aiProvidersSettingSchema = z.object({
  defaultProvider: llmProviderSchema.optional(),
  providers: z
    .object({
      openai: providerEntrySchema.optional(),
      anthropic: providerEntrySchema.optional(),
      github: providerEntrySchema.optional(),
      ollama: providerEntrySchema.optional(),
      cursor: providerEntrySchema.optional(),
      gemini: providerEntrySchema.optional(),
    })
    .default({}),
});

export type ProviderEntry = z.infer<typeof providerEntrySchema>;
export type AiProvidersSetting = z.infer<typeof aiProvidersSettingSchema>;

export type ResolvedProvider = {
  id: LlmProvider;
  apiKey?: string;
  model?: string;
  baseURL?: string;
  source: "portal" | "env" | "none";
};

function trim(value: string | undefined | null) {
  const v = value?.trim();
  return v ? v : undefined;
}

export async function getAiProvidersSetting(): Promise<AiProvidersSetting> {
  const raw = await getAppSetting<unknown>(SETTING_AI_PROVIDERS);
  const parsed = aiProvidersSettingSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { providers: {} };
  }
  return parsed.data;
}

export async function saveAiProvidersSetting(value: AiProvidersSetting) {
  const parsed = aiProvidersSettingSchema.parse(value);
  await setAppSetting(SETTING_AI_PROVIDERS, parsed);
  return parsed;
}

/** Env-only snapshot for a provider (no portal merge). */
export function envProviderEntry(id: LlmProvider): ProviderEntry {
  switch (id) {
    case "openai":
      return {
        apiKey: trim(process.env.OPENAI_API_KEY),
        model: trim(process.env.OPENAI_MODEL) ?? "gpt-4.1",
      };
    case "anthropic":
      return {
        apiKey: trim(process.env.ANTHROPIC_API_KEY),
        model: trim(process.env.ANTHROPIC_MODEL) ?? "claude-sonnet-4-5",
      };
    case "github":
      return {
        apiKey: trim(process.env.GITHUB_TOKEN),
        model: trim(process.env.GITHUB_MODEL) ?? "openai/gpt-4.1",
      };
    case "ollama":
      return {
        baseURL: trim(process.env.OLLAMA_BASE_URL) ?? "http://localhost:11434/v1",
        model: trim(process.env.OLLAMA_MODEL) ?? "llama3.1",
      };
    case "cursor":
      return {
        apiKey: trim(process.env.CURSOR_API_KEY),
        model: trim(process.env.CURSOR_MODEL) ?? "composer-2.5",
        baseURL: trim(process.env.CURSOR_BASE_URL),
      };
    case "gemini":
      return {
        apiKey:
          trim(process.env.GOOGLE_GENERATIVE_AI_API_KEY) ??
          trim(process.env.GEMINI_API_KEY),
        model: trim(process.env.GEMINI_MODEL) ?? "gemini-2.5-flash",
      };
  }
}

function portalHasCredentials(id: LlmProvider, entry: ProviderEntry | undefined) {
  if (!entry) return false;
  if (id === "ollama") return Boolean(entry.baseURL || entry.model);
  return Boolean(trim(entry.apiKey));
}

/**
 * Portal wins when it has credentials; otherwise fall back to env.
 */
export async function resolveProvider(
  provider?: LlmProvider,
): Promise<ResolvedProvider> {
  const setting = await getAiProvidersSetting();
  const selected =
    provider ??
    setting.defaultProvider ??
    (trim(process.env.LLM_PROVIDER) as LlmProvider | undefined) ??
    "openai";

  const portal = setting.providers[selected];
  const env = envProviderEntry(selected);

  if (portalHasCredentials(selected, portal)) {
    return {
      id: selected,
      apiKey: trim(portal?.apiKey) ?? trim(env.apiKey),
      model: trim(portal?.model) ?? trim(env.model),
      baseURL: rewriteLoopbackForDocker(
        trim(portal?.baseURL) ?? trim(env.baseURL),
      ),
      source: "portal",
    };
  }

  if (selected === "ollama" || trim(env.apiKey) || trim(env.baseURL)) {
    const ready =
      selected === "ollama"
        ? Boolean(env.baseURL)
        : Boolean(trim(env.apiKey));
    if (ready) {
      return {
        id: selected,
        apiKey: env.apiKey,
        model: env.model,
        baseURL: rewriteLoopbackForDocker(env.baseURL),
        source: "env",
      };
    }
  }

  return {
    id: selected,
    apiKey: undefined,
    model: env.model,
    baseURL: rewriteLoopbackForDocker(env.baseURL),
    source: "none",
  };
}

export function maskSecret(value: string | undefined | null): string | null {
  const v = trim(value);
  if (!v) return null;
  if (v.length <= 4) return "••••";
  return `••••${v.slice(-4)}`;
}

export type ProviderPublicStatus = {
  id: LlmProvider;
  label: string;
  ready: boolean;
  detail: string;
  source: "portal" | "env" | "none";
  portalConfigured: boolean;
  maskedApiKey: string | null;
  model: string | null;
  baseURL: string | null;
  maskedBaseURL: string | null;
};

const LABELS: Record<LlmProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  github: "GitHub Models",
  ollama: "Ollama",
  cursor: "Cursor",
  gemini: "Google Gemini",
};

export async function getProviderPublicStatuses(): Promise<ProviderPublicStatus[]> {
  const setting = await getAiProvidersSetting();
  const ids = llmProviderSchema.options as unknown as LlmProvider[];

  return Promise.all(
    ids.map(async (id) => {
      const resolved = await resolveProvider(id);
      const portal = setting.providers[id];
      const portalConfigured = portalHasCredentials(id, portal);
      const ready =
        id === "ollama"
          ? Boolean(resolved.baseURL)
          : Boolean(resolved.apiKey);

      let detail: string;
      if (!ready) {
        detail = "Add credentials in this page (or set env as fallback)";
      } else if (id === "cursor" && resolved.baseURL) {
        detail = `Proxy · ${resolved.model ?? "composer-2.5"} · ${resolved.source}`;
      } else if (id === "cursor") {
        detail = `SDK · ${resolved.model ?? "composer-2.5"} · ${resolved.source}`;
      } else {
        detail = `${resolved.model ?? "default"} · ${resolved.source}`;
      }

      return {
        id,
        label: LABELS[id],
        ready,
        detail,
        source: resolved.source,
        portalConfigured,
        maskedApiKey: maskSecret(portal?.apiKey ?? (resolved.source === "env" ? resolved.apiKey : undefined)),
        model: resolved.model ?? null,
        baseURL: id === "ollama" || id === "cursor" ? resolved.baseURL ?? null : null,
        maskedBaseURL:
          id === "cursor" && resolved.baseURL
            ? resolved.baseURL.replace(/^(https?:\/\/[^/]+).*/, "$1/…")
            : resolved.baseURL ?? null,
      };
    }),
  );
}

export async function getDefaultProviderId(): Promise<LlmProvider> {
  const setting = await getAiProvidersSetting();
  return (
    setting.defaultProvider ??
    (trim(process.env.LLM_PROVIDER) as LlmProvider | undefined) ??
    "openai"
  );
}

export async function upsertPortalProvider(
  id: LlmProvider,
  patch: {
    apiKey?: string;
    model?: string;
    baseURL?: string;
    clearApiKey?: boolean;
    setAsDefault?: boolean;
  },
) {
  const setting = await getAiProvidersSetting();
  const existing = setting.providers[id] ?? {};
  const next: ProviderEntry = { ...existing };

  if (patch.clearApiKey) {
    delete next.apiKey;
  } else if (typeof patch.apiKey === "string" && patch.apiKey.trim()) {
    next.apiKey = patch.apiKey.trim();
  }
  // empty apiKey string → keep existing

  if (typeof patch.model === "string") {
    const m = patch.model.trim();
    if (m) next.model = m;
    else delete next.model;
  }

  if (typeof patch.baseURL === "string") {
    const b = patch.baseURL.trim();
    if (b) next.baseURL = b;
    else delete next.baseURL;
  }

  const providers = { ...setting.providers, [id]: next };
  // Drop empty entries
  if (!next.apiKey && !next.model && !next.baseURL) {
    delete providers[id];
  }

  const updated: AiProvidersSetting = {
    providers,
    defaultProvider: patch.setAsDefault
      ? id
      : setting.defaultProvider,
  };
  return saveAiProvidersSetting(updated);
}

export async function clearPortalProvider(id: LlmProvider) {
  const setting = await getAiProvidersSetting();
  const providers = { ...setting.providers };
  delete providers[id];
  return saveAiProvidersSetting({
    providers,
    defaultProvider:
      setting.defaultProvider === id ? undefined : setting.defaultProvider,
  });
}
