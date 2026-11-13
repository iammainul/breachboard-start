export type RssEntry = {
  title: string;
  link: string;
  description: string;
  publishedAt: Date | null;
};

function decodeXml(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeFeedText(text: string) {
  return decodeXml(text);
}

function firstTag(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
    );
    if (match?.[1]) return decodeXml(match[1]);
  }
  return "";
}

function linkFromBlock(block: string) {
  const hrefLink = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (hrefLink?.[1]) return decodeXml(hrefLink[1]);
  const textLink = firstTag(block, ["link"]);
  if (textLink.startsWith("http")) return textLink;
  const guid = firstTag(block, ["guid"]);
  if (guid.startsWith("http")) return guid;
  return textLink;
}

function dateFromBlock(block: string) {
  const raw = firstTag(block, ["pubDate", "published", "updated", "dc:date"]);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Parse RSS 2.0 `<item>` and Atom `<entry>` blocks. */
export function parseFeedEntries(xml: string, limit = 12): RssEntry[] {
  const blocks = [
    ...(xml.match(/<item[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []),
  ];
  const items: RssEntry[] = [];
  for (const block of blocks) {
    if (items.length >= limit) break;
    const title = firstTag(block, ["title"]);
    const link = linkFromBlock(block);
    const description = firstTag(block, [
      "description",
      "summary",
      "content",
      "content:encoded",
    ]);
    if (!title || !link) continue;
    items.push({
      title: title.slice(0, 240),
      link,
      description: description || title,
      publishedAt: dateFromBlock(block),
    });
  }
  return items;
}

export function feedUserAgent() {
  return "Breachboard/1.0 (+https://localhost; cyber tabletop intel ingest)";
}
