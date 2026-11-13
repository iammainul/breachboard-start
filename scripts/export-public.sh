#!/usr/bin/env bash
# Build a public tree: source code and documentation only.
# Refuses anything else. Private filter files are never copied.
# Does not push.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  echo "usage: scripts/export-public.sh DEST_DIR" >&2
  exit 2
fi

rm -rf "$DEST"
mkdir -p "$DEST"
export PYTHONDONTWRITEBYTECODE=1

python3 - "$ROOT" "$DEST" <<'PY'
import importlib.util
import pathlib
import shutil
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
dest = pathlib.Path(sys.argv[2])

# These stay in the private repository. They name records and identifiers.
private_only = {
    "scripts/public-publish.deny",
    "scripts/public-publish.needles",
    "scripts/public-publish.redact.py",
}

deny = set()
deny_path = root / "scripts/public-publish.deny"
if deny_path.is_file():
    for line in deny_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            deny.add(line)

source_prefixes = (
    "app/",
    "components/",
    "lib/",
    "prisma/",
    "scripts/",
    "tests/",
    "types/",
    "public/",
    "docker/",
    ".github/",
    ".cursor/rules/",
)
doc_prefixes = ("docs/", "design/")
root_files = {
    ".gitignore",
    ".dockerignore",
    ".env.example",
    "Dockerfile",
    "docker-entrypoint.sh",
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "eslint.config.mjs",
    "instrumentation.ts",
    "next.config.ts",
    "package.json",
    "package-lock.json",
    "playwright.config.ts",
    "postcss.config.mjs",
    "proxy.ts",
    "run.sh",
    "skills-lock.json",
    "tsconfig.json",
    "vitest.config.ts",
}
source_suffixes = {
    ".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".prisma", ".sql",
    ".json", ".yml", ".yaml", ".toml", ".sh", ".svg", ".png", ".ico",
    ".mdc", ".py",
}
doc_suffixes = {".md", ".mdc", ".png", ".svg", ".css"}

listed = subprocess.check_output(["git", "ls-files", "-z"], cwd=root)
paths = [p.decode() for p in listed.split(b"\0") if p]

kept, held = [], []

def allowed(path: str) -> bool:
    if path in root_files:
        return True
    suffix = pathlib.Path(path).suffix
    if path.startswith(source_prefixes):
        return suffix in source_suffixes or path.endswith("Dockerfile")
    if path.startswith(doc_prefixes):
        return suffix in doc_suffixes
    return False

for path in paths:
    if path in private_only or path in deny:
        held.append(path)
        continue
    if not allowed(path):
        print(f"REFUSE {path}: not source code or documentation", file=sys.stderr)
        sys.exit(1)
    target = dest / path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / path, target)
    kept.append(path)

redact_path = root / "scripts/public-publish.redact.py"
if redact_path.is_file():
    spec = importlib.util.spec_from_file_location("public_publish_redact", redact_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.redact(dest)

needles = [
    "BEGIN " + "PRIVATE",
    "BEGIN " + "RSA",
    "AK" + "IA",
    "gh" + "p_",
    "gh" + "o_",
    "sk-" + "proj-",
]
needles_path = root / "scripts/public-publish.needles"
if needles_path.is_file():
    for line in needles_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            needles.append(line)

hits = []
for path in dest.rglob("*"):
    if not path.is_file():
        continue
    if path.suffix.lower() in {".png", ".ico", ".svg"}:
        continue
    text = path.read_text(errors="ignore")
    for needle in needles:
        if needle in text:
            hits.append(f"{path.relative_to(dest)}: {needle}")
if hits:
    print("REFUSE export still contains held-back identifiers or secrets:", file=sys.stderr)
    print("\n".join(hits), file=sys.stderr)
    sys.exit(1)

print(f"KEPT {len(kept)} files")
print(f"HELD BACK {len(held)} files")
for line in held:
    print(f"  {line}")
PY

echo "Export ready at $DEST"
