export const THEME_IDS = ["dark", "light"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const FINISH_IDS = ["glass"] as const;
export type FinishId = (typeof FINISH_IDS)[number];

export const DEFAULT_THEME: ThemeId = "dark";
export const DEFAULT_FINISH: FinishId = "glass";
export const THEME_STORAGE_KEY = "breachboard-theme";
export const FINISH_STORAGE_KEY = "breachboard-finish";
export const LEGACY_THEME_STORAGE_KEY = "n0ts01337-theme";
export const LEGACY_TTX_THEME_STORAGE_KEY = "ttx-theme";

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  institution: "light",
  regulator: "light",
  arena: "dark",
  nightops: "dark",
  dark: "dark",
  light: "light",
};

export const THEME_OPTIONS: {
  id: ThemeId;
  label: string;
  audience: string;
  description: string;
  preview: { bg: string; card: string; primary: string };
}[] = [
  {
    id: "dark",
    label: "Pitch Obsidian",
    audience: "Ops desk · default",
    description:
      "Toxic phosphor liquid glass on pitch obsidian — frosted panels for live facilitation.",
    preview: { bg: "#0B0F0D", card: "#121815", primary: "#00FF66" },
  },
  {
    id: "light",
    label: "Toxic Phosphor Day",
    audience: "Daytime · print",
    description:
      "Cool paper phosphor with the same liquid-glass surfaces for daytime desks and briefs.",
    preview: { bg: "#F0F8F4", card: "#FFFFFF", primary: "#008833" },
  },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

export function isFinishId(value: string | null | undefined): value is FinishId {
  return FINISH_IDS.includes(value as FinishId);
}

export function resolveThemeId(value: string | null | undefined): ThemeId {
  if (isThemeId(value)) return value;
  if (value && value in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[value];
  return DEFAULT_THEME;
}

export function resolveFinishId(_value?: string | null): FinishId {
  return DEFAULT_FINISH;
}
