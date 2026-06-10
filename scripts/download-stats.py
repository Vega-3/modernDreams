#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# scripts/download-stats.py — count app downloads from GitHub Releases.
#
# Usage:
#   python3 scripts/download-stats.py              # human-readable table
#   python3 scripts/download-stats.py --json       # machine-readable JSON
#   GITHUB_TOKEN=ghp_xxx python3 scripts/download-stats.py   # higher rate limit
#
# Why this approach:
#   GitHub stores a download_count on every release asset and exposes it through
#   the public REST API. Summing those counts gives an exact, privacy-clean
#   measure of how many installers users have pulled — with ZERO changes to the
#   app and ZERO data collected about any individual user or their dreams. The
#   count is server-side at GitHub; the desktop app never phones home.
#
# What it measures (and what it doesn't):
#   - Downloads = top of the funnel (intent to install). One person who tries
#     three platforms counts three times; a download isn't a guaranteed install.
#   - It is NOT an active-user count. We deliberately avoid app-side telemetry
#     because the product's public promise is "no telemetry, total privacy."
#     Downloads are the honest privacy-respecting proxy for userbase size.
# ─────────────────────────────────────────────────────────────────────────────

import json
import os
import sys
import urllib.error
import urllib.request

REPO = "Vega-3/modernDreams"
API = f"https://api.github.com/repos/{REPO}/releases?per_page=100"

# Map a release-asset filename to a coarse platform bucket. Matched on suffix so
# it survives version/arch changes in the filename (e.g. _0.3.0_amd64.deb).
PLATFORM_BY_SUFFIX = {
    ".deb": "Linux (.deb)",
    ".appimage": "Linux (.AppImage)",
    ".rpm": "Linux (.rpm)",
    ".msi": "Windows (.msi)",
    ".exe": "Windows (.exe)",
    ".dmg": "macOS (.dmg)",
    ".app.tar.gz": "macOS (.app)",
}


def classify(filename: str) -> str | None:
    """Return the platform bucket for an asset filename, or None to ignore it
    (e.g. .sig signatures, latest.json updater manifests, checksums)."""
    lower = filename.lower()
    # Longest suffixes first so '.app.tar.gz' wins over '.tar.gz'.
    for suffix in sorted(PLATFORM_BY_SUFFIX, key=len, reverse=True):
        if lower.endswith(suffix):
            return PLATFORM_BY_SUFFIX[suffix]
    return None


# --- Fetch ------------------------------------------------------------------
# Unauthenticated calls are rate-limited to 60/hour, which is plenty for a
# manual stats check. A GITHUB_TOKEN lifts that to 5000/hour for CI use.
def fetch_releases() -> list[dict]:
    req = urllib.request.Request(API, headers={"Accept": "application/vnd.github+json"})
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"GitHub API error {e.code}: {e.reason} (repo {REPO})")
    except urllib.error.URLError as e:
        sys.exit(f"Network error reaching GitHub: {e.reason}")


# --- Aggregate --------------------------------------------------------------
def aggregate(releases: list[dict]) -> dict:
    by_platform: dict[str, int] = {}
    by_release: list[dict] = []
    total = 0

    for rel in releases:
        if rel.get("draft"):
            continue  # unpublished drafts aren't real downloads
        rel_total = 0
        rel_platforms: dict[str, int] = {}
        for asset in rel.get("assets", []):
            bucket = classify(asset["name"])
            if bucket is None:
                continue
            count = asset.get("download_count", 0)
            rel_total += count
            total += count
            by_platform[bucket] = by_platform.get(bucket, 0) + count
            rel_platforms[bucket] = rel_platforms.get(bucket, 0) + count
        if rel_total:
            by_release.append(
                {"tag": rel.get("tag_name", "?"), "total": rel_total, "platforms": rel_platforms}
            )

    return {"total": total, "by_platform": by_platform, "by_release": by_release}


# --- Render -----------------------------------------------------------------
def render_table(stats: dict) -> str:
    lines = [f"\n  Ipsacarta download stats — {REPO}", "  " + "─" * 44]
    if stats["total"] == 0:
        lines.append("  No published release downloads yet.")
        return "\n".join(lines)

    lines.append("\n  By platform")
    for plat, count in sorted(stats["by_platform"].items(), key=lambda kv: -kv[1]):
        lines.append(f"    {plat:<22} {count:>8,}")

    lines.append("\n  By release")
    for rel in stats["by_release"]:
        lines.append(f"    {rel['tag']:<22} {rel['total']:>8,}")

    lines.append("  " + "─" * 44)
    lines.append(f"    {'TOTAL DOWNLOADS':<22} {stats['total']:>8,}")
    return "\n".join(lines)


if __name__ == "__main__":
    stats = aggregate(fetch_releases())
    if "--json" in sys.argv[1:]:
        print(json.dumps(stats, indent=2))
    else:
        print(render_table(stats))
