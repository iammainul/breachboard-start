import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/access";
import { importLibraryPack } from "@/lib/library/pack";
import { denyCrossSiteMutation } from "@/lib/security/api-guard";
import { UPLOAD_LIMITS, validateUpload } from "@/lib/security/upload";

export async function POST(request: Request) {
  const csrf = denyCrossSiteMutation(request);
  if (csrf) return csrf;
  const actor = await requireApiAdmin();
  if ("error" in actor) return actor.error;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let raw: unknown;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const checked = validateUpload({
        kind: "library-pack",
        filename: file.name || "pack.json",
        declaredMime: file.type || "application/json",
        bytes: buf,
        size: file.size,
      });
      if ("error" in checked) {
        return NextResponse.json({ error: checked.error }, { status: checked.status });
      }
      const text = buf.toString("utf8");
      raw = JSON.parse(text);
    } else {
      const cloned = request.clone();
      const buf = Buffer.from(await cloned.arrayBuffer());
      if (buf.byteLength > UPLOAD_LIMITS["library-pack"]) {
        return NextResponse.json({ error: "Pack is too large" }, { status: 400 });
      }
      raw = JSON.parse(buf.toString("utf8"));
    }

    const result = await importLibraryPack(raw);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Import failed — invalid pack",
      },
      { status: 400 },
    );
  }
}
