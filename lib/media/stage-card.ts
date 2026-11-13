import { writeMediaFile } from "@/lib/media/fs";

function escapeXml(value: string) {
  return value.replace(/[<>&]/g, (ch) => {
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    return "&amp;";
  });
}

export function stageCardSvg(opts: {
  sequence: number;
  title: string;
  subtitle: string;
  footer?: string;
}) {
  const label = `INJ-${String(opts.sequence).padStart(2, "0")}`;
  const title = escapeXml(opts.title).slice(0, 80);
  const subtitle = escapeXml(opts.subtitle).slice(0, 140);
  const footer = escapeXml(opts.footer ?? "BREACHBOARD · TABLETOP");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="864" viewBox="0 0 1536 864">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b3d3a"/>
      <stop offset="55%" stop-color="#125e57"/>
      <stop offset="100%" stop-color="#1a7a6d"/>
    </linearGradient>
  </defs>
  <rect width="1536" height="864" fill="url(#g)"/>
  <circle cx="1280" cy="160" r="220" fill="#ffffff" opacity="0.06"/>
  <circle cx="200" cy="720" r="280" fill="#ffffff" opacity="0.05"/>
  <rect x="72" y="72" width="1392" height="720" rx="28" fill="#ffffff" opacity="0.08" stroke="#9fe8d8" stroke-opacity="0.35"/>
  <text x="110" y="160" fill="#9fe8d8" font-family="ui-sans-serif,system-ui,sans-serif" font-size="36" font-weight="700" letter-spacing="4">${label}</text>
  <text x="110" y="250" fill="#ffffff" font-family="ui-sans-serif,system-ui,sans-serif" font-size="56" font-weight="700">${title}</text>
  <text x="110" y="330" fill="#d7f5ee" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28">${subtitle}</text>
  <text x="110" y="720" fill="#9fe8d8" font-family="ui-sans-serif,system-ui,sans-serif" font-size="24" font-weight="600">${footer}</text>
</svg>`;
}

export async function writeStageCardFile(opts: {
  exerciseId: string;
  injectId: string;
  sequence: number;
  title: string;
  subtitle: string;
  footer?: string;
}) {
  const fileName = `${opts.injectId}-stage.svg`;
  const svg = stageCardSvg(opts);
  return writeMediaFile(
    `uploads/${opts.exerciseId}`,
    fileName,
    Buffer.from(svg, "utf8"),
  );
}
