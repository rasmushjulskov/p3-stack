#!/usr/bin/env bash
# Install p3-stack skills for T3 Code.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${HOME}/.agents/skills"

if [[ "${1:-}" == "--project" ]]; then
  TARGET="${2:?usage: ./install.sh --project /path/to/repo}/.agents/skills"
fi

mkdir -p "$TARGET"
installed=0
skipped=0
pruned=0

# Drop links into this repo whose skill no longer exists, such as the old p3-mode.
for link in "$TARGET"/*; do
  if [[ -L "$link" && ! -e "$link" && "$(readlink "$link")" == "$ROOT"/skills/* ]]; then
    rm "$link"
    pruned=$((pruned + 1))
  fi
done

for skill in "$ROOT"/skills/*/; do
  name="$(basename "$skill")"
  if [[ -L "$TARGET/$name" ]]; then
    rm "$TARGET/$name"
  elif [[ -e "$TARGET/$name" ]]; then
    printf 'skip %s (exists and is not a symlink)\n' "$name"
    skipped=$((skipped + 1))
    continue
  fi
  ln -s "${skill%/}" "$TARGET/$name"
  installed=$((installed + 1))
done

printf 'linked %d skills into %s' "$installed" "$TARGET"
if [[ "$pruned" -gt 0 ]]; then
  printf ', removed %d stale links' "$pruned"
fi
if [[ "$skipped" -gt 0 ]]; then
  printf ' (%d skipped)' "$skipped"
fi
printf '\n'
