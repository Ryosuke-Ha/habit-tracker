#!/usr/bin/env python3
"""
Analyzes the git diff of the latest commit and uses the Claude API to update
any documentation files that are directly affected by the code changes.

Managed documents:
  README.md, CHANGELOG.md, docs/api.md, docs/architecture.md,
  docs/database.md, docs/development.md

Usage:
  Normally invoked by .github/workflows/docs-update.yml, but can be run
  locally for testing:

    ANTHROPIC_API_KEY=sk-... python scripts/update_docs.py
"""

import json
import os
import re
import subprocess
import sys

import anthropic

# ── Configuration ────────────────────────────────────────────────────────────

MANAGED_DOCS = [
    "README.md",
    "CHANGELOG.md",
    "docs/api.md",
    "docs/architecture.md",
    "docs/database.md",
    "docs/development.md",
]

# Caps to stay within the model's context window without wasting tokens
MAX_DIFF_CHARS = 40_000
MAX_DOC_CHARS = 25_000

MODEL = "claude-opus-4-6"
MAX_TOKENS = 16_000

# ── Helpers ──────────────────────────────────────────────────────────────────


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout


def get_diff() -> str:
    """Return the unified diff of source-code changes in the latest commit."""
    diff = run(
        [
            "git", "diff", "HEAD~1", "HEAD", "--",
            "frontend/", "backend/", "slack-bot/",
        ]
    )
    if len(diff) > MAX_DIFF_CHARS:
        diff = diff[:MAX_DIFF_CHARS] + "\n\n[... diff truncated at 40 000 chars ...]"
    return diff


def get_changed_files() -> list[str]:
    out = run(["git", "diff", "--name-only", "HEAD~1", "HEAD"])
    return [f for f in out.strip().splitlines() if f]


def read_doc(path: str) -> str:
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
        if len(content) > MAX_DOC_CHARS:
            content = content[:MAX_DOC_CHARS] + "\n\n[... truncated ...]"
        return content
    except FileNotFoundError:
        return ""


def extract_json(text: str) -> dict:
    """
    Extract a JSON object from Claude's response.
    Handles both bare JSON and responses wrapped in ```json ... ``` fences.
    """
    # Strip markdown code fences if present
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        return json.loads(fenced.group(1))
    # Fall back to the first { ... } block
    raw = re.search(r"\{.*\}", text, re.DOTALL)
    if raw:
        return json.loads(raw.group())
    raise ValueError("No JSON object found in Claude response")


# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a documentation maintainer for a habit-tracking web application called habit-tracker.

Tech stack:
- Frontend : Next.js 14 (TypeScript, App Router), Tailwind CSS, NextAuth.js — deployed on Vercel
- Backend  : FastAPI (Python 3.11), SQLAlchemy 2, Alembic, PostgreSQL on Supabase — deployed on Railway
- Slack Bot: Python, Anthropic Claude API, PyGitHub — deployed on Railway
- CI/CD    : GitHub Actions

Your task:
1. Read the git diff of the latest source-code commit.
2. Decide which documentation files need to be updated as a direct result of those changes.
3. Return ONLY the files that genuinely need changes — do not update docs that are unaffected.

Rules:
- Preserve the existing document structure, headings, and formatting exactly.
- Write everything in English.
- For CHANGELOG.md: add new entries under the [Unreleased] section only.
  Never modify existing versioned sections (e.g. [1.0.0]).
- Only document what actually changed — do not invent features or speculate.
- Be concise and accurate.

Response format — return a single JSON object and NOTHING else (no prose, no fences):
{
  "updates": [
    {
      "file": "docs/api.md",
      "content": "... complete updated file content ..."
    }
  ]
}

If no documentation needs updating, return exactly: {"updates": []}
"""


def build_user_message(diff: str, docs_context: str, changed_files: list[str]) -> str:
    return f"""\
## Changed source files

{chr(10).join(f"- {f}" for f in changed_files)}

## Git diff

```diff
{diff}
```

## Current documentation

{docs_context}

Analyze the diff and return updated documentation for any files that need changes.
Return the COMPLETE file content for each updated file (not just the changed section).
"""


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    diff = get_diff()
    if not diff.strip():
        print("No relevant diff found — skipping documentation update.")
        return

    changed_files = get_changed_files()
    print(f"Changed files: {changed_files}")

    # Build docs context from current on-disk content
    docs_parts: list[str] = []
    for path in MANAGED_DOCS:
        content = read_doc(path)
        if content:
            docs_parts.append(f"=== {path} ===\n{content}")
    docs_context = "\n\n".join(docs_parts)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY environment variable is not set.")
        sys.exit(0)  # exit 0 so the CI step doesn't fail the whole workflow

    client = anthropic.Anthropic(api_key=api_key)

    print(f"Sending diff to Claude ({MODEL}) for analysis…")
    full_response = ""
    with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": build_user_message(diff, docs_context, changed_files),
            }
        ],
    ) as stream:
        for text in stream.text_stream:
            full_response += text
            print(text, end="", flush=True)
    print()  # newline after stream ends

    # Parse the JSON response
    try:
        data = extract_json(full_response)
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: Failed to parse Claude response as JSON: {exc}")
        print("Raw response (first 2 000 chars):")
        print(full_response[:2_000])
        sys.exit(0)  # exit 0 — doc update failure should not block CI

    updates: list[dict] = data.get("updates", [])
    if not updates:
        print("Claude determined no documentation updates are needed.")
        return

    # Write updated files
    for update in updates:
        file_path: str = update.get("file", "")
        content: str = update.get("content", "")

        if file_path not in MANAGED_DOCS:
            print(f"SKIP (not in managed list): {file_path}")
            continue
        if not content.strip():
            print(f"SKIP (empty content returned): {file_path}")
            continue

        parent = os.path.dirname(file_path)
        if parent:
            os.makedirs(parent, exist_ok=True)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated: {file_path}")


if __name__ == "__main__":
    main()
