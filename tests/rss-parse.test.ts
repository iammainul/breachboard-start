import { describe, expect, it } from "vitest";
import { parseFeedEntries } from "@/lib/intel/rss";

const RSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>LockBit hits a payments switch</title>
      <link>https://krebsonsecurity.com/2026/09/lockbit-payments</link>
      <description><![CDATA[A ransomware crew <b>disrupted</b> settlement. CVE-2024-1234]]></description>
      <pubDate>Tue, 08 Sep 2026 10:15:00 GMT</pubDate>
    </item>
    <item>
      <title></title>
      <link>https://example.com/empty</link>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>NCSC alert on phishing kits</title>
    <link href="https://www.ncsc.gov.uk/alert/phishing" />
    <published>2026-09-07T09:00:00Z</published>
    <summary>Credential theft against finance staff.</summary>
  </entry>
</feed>`;

describe("parseFeedEntries", () => {
  it("reads RSS titles, links, stripped HTML, and pubDate", () => {
    const items = parseFeedEntries(RSS, 8);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("LockBit hits a payments switch");
    expect(items[0]?.link).toBe(
      "https://krebsonsecurity.com/2026/09/lockbit-payments",
    );
    expect(items[0]?.description).toContain("ransomware crew");
    expect(items[0]?.description).toContain("CVE-2024-1234");
    expect(items[0]?.description).not.toContain("<b>");
    expect(items[0]?.publishedAt?.toISOString()).toBe("2026-09-08T10:15:00.000Z");
  });

  it("reads Atom entries with href links", () => {
    const items = parseFeedEntries(ATOM, 8);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("NCSC alert on phishing kits");
    expect(items[0]?.link).toBe("https://www.ncsc.gov.uk/alert/phishing");
    expect(items[0]?.publishedAt?.toISOString()).toBe("2026-09-07T09:00:00.000Z");
  });

  it("decodes numeric HTML entities in titles", () => {
    const xml = `<rss><channel><item>
      <title>Two Alleged &#8216;TeamPCP&#8217; Hackers</title>
      <link>https://krebsonsecurity.com/teampcp</link>
    </item></channel></rss>`;

    expect(parseFeedEntries(xml, 1)[0]?.title).toBe(
      "Two Alleged ‘TeamPCP’ Hackers",
    );
  });

  it("caps the number of returned entries", () => {
    const xml = `<rss><channel>${Array.from(
      { length: 5 },
      (_, i) =>
        `<item><title>Story ${i}</title><link>https://ex.test/${i}</link></item>`,
    ).join("")}</channel></rss>`;

    expect(parseFeedEntries(xml, 3)).toHaveLength(3);
  });
});
