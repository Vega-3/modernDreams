#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/release.sh — bump version across all config files, tag the commit,
#                      and deploy the Vercel landing page.
#
# Usage:
#   bash scripts/release.sh <version> "<changelog line>"
#
# Examples:
#   bash scripts/release.sh 0.2.0 "Add handwriting import, fix bold/italic on Linux"
#   bash scripts/release.sh 1.0.0 "First stable release"
#
# What it does:
#   1. Validates the version string (semver: X.Y.Z or X.Y.Z-suffix)
#   2. Bumps version in Cargo.toml, src-tauri/tauri.conf.json, package.json
#   3. Commits the bump and creates a git tag v<version>
#   4. Pushes the tag to origin (triggers GitHub Actions cross-platform build)
#   5. Calls ~/Desktop/dreams-landing/deploy.sh to update the Vercel landing page
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VERSION="${1:?Usage: bash scripts/release.sh <version> \"<changelog line>\"}"
MESSAGE="${2:?Usage: bash scripts/release.sh <version> \"<changelog line>\"}"

# Validate semver format (X.Y.Z or X.Y.Z-suffix)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: version must be semver (e.g. 0.2.0 or 1.0.0-beta)" >&2
  exit 1
fi

# Must run from the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

LANDING_DEPLOY="$HOME/Desktop/dreams-landing/deploy.sh"

echo ""
echo "  Dreams Desktop Release"
echo "  Version : $VERSION"
echo "  Message : $MESSAGE"
echo ""

# ── 1. Bump Cargo.toml workspace version ──────────────────────────────────
# Targets the single `version = "..."` line under [workspace.package].
sed -i "s/^version = \".*\"/version = \"$VERSION\"/" Cargo.toml
echo "  ✓ Cargo.toml → $VERSION"

# ── 2. Bump src-tauri/tauri.conf.json version ─────────────────────────────
# Targets the top-level "version" field (first occurrence).
# Using Python for reliable JSON-aware replacement without requiring jq.
python3 - <<PYEOF
import json, pathlib
p = pathlib.Path("src-tauri/tauri.conf.json")
data = json.loads(p.read_text())
data["version"] = "$VERSION"
p.write_text(json.dumps(data, indent=2) + "\n")
PYEOF
echo "  ✓ src-tauri/tauri.conf.json → $VERSION"

# ── 3. Bump package.json version ──────────────────────────────────────────
# npm version handles the JSON write; --no-git-tag-version skips npm's own commit/tag.
npm version "$VERSION" --no-git-tag-version --silent
echo "  ✓ package.json → $VERSION"

# ── 4. Git commit + tag ───────────────────────────────────────────────────
git add Cargo.toml src-tauri/tauri.conf.json package.json
git commit -m "chore: release v$VERSION"
git tag "v$VERSION" -m "v$VERSION: $MESSAGE"
echo "  ✓ Git commit + tag v$VERSION created"

# ── 5. Push tag to origin (triggers GitHub Actions build) ─────────────────
if git remote get-url origin &>/dev/null; then
  git push origin main --follow-tags
  echo "  ✓ Pushed to origin — GitHub Actions release build triggered"
  echo "    Watch: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/' | sed 's/.*github.com[:/]//')/actions"
else
  echo "  ⚠ No git remote 'origin' found — skipping push. Tag is local only."
fi

# ── 6. Deploy landing page to Vercel ──────────────────────────────────────
if [[ -f "$LANDING_DEPLOY" ]]; then
  echo ""
  echo "  Deploying landing page..."
  bash "$LANDING_DEPLOY" "$VERSION" "$MESSAGE"
else
  echo ""
  echo "  ⚠ Landing page deploy script not found at: $LANDING_DEPLOY"
  echo "    Run manually: bash ~/Desktop/dreams-landing/deploy.sh $VERSION \"$MESSAGE\""
fi

echo ""
echo "  ✅ Release v$VERSION complete."
echo ""
echo "  Next steps:"
echo "    • GitHub Actions will build installers for all 3 platforms on the tag push."
echo "    • Download artifacts from the GitHub Release page once the workflow finishes."
echo "    • Linux build   : .deb + .AppImage  (ubuntu-latest runner)"
echo "    • Windows build : .msi + .exe       (windows-latest runner)"
echo "    • macOS build   : .dmg              (macos-latest runner)"
echo ""
