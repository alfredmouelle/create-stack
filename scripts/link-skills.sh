#!/usr/bin/env bash
#
# Symlink the skills in this repo's skills/ directory into an agent's config
# directory, so editing a skill here updates what the agent uses — no copy step.
#
# Targets (each consumes a different on-disk format):
#   --claude  (default)  ~/.claude/skills/<name>/         dir symlink (SKILL.md)
#   --codex              ~/.codex/prompts/<name>.md       file symlink to SKILL.md
#
# Override the destination per target with $CLAUDE_SKILLS_DIR / $CODEX_PROMPTS_DIR.
#
# Usage:
#   ./scripts/link-skills.sh                 # link into Claude (default)
#   ./scripts/link-skills.sh --codex         # link into Codex
#   ./scripts/link-skills.sh --claude --unlink
#   ./scripts/link-skills.sh --codex --unlink

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_DIR/skills"

target="claude"
unlink_mode=false
for arg in "$@"; do
  case "$arg" in
    --claude) target="claude" ;;
    --codex) target="codex" ;;
    --unlink) unlink_mode=true ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [ ! -d "$SRC_DIR" ]; then
  echo "No skills/ directory in $REPO_DIR" >&2
  exit 1
fi

# Resolve destination + linking style for the chosen target.
case "$target" in
  claude) DEST_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"; style="dir" ;;
  codex)  DEST_DIR="${CODEX_PROMPTS_DIR:-$HOME/.codex/prompts}"; style="file" ;;
esac

mkdir -p "$DEST_DIR"

# Compute the link target path + the source path for a given skill.
for skill_path in "$SRC_DIR"/*/; do
  [ -d "$skill_path" ] || continue
  name="$(basename "$skill_path")"
  src="${skill_path%/}"

  if [ "$style" = "file" ]; then
    src="$src/SKILL.md"
    target_path="$DEST_DIR/$name.md"
    [ -f "$src" ] || { echo "skip      $name (no SKILL.md)"; continue; }
  else
    target_path="$DEST_DIR/$name"
  fi

  if $unlink_mode; then
    if [ -L "$target_path" ]; then
      rm "$target_path"
      echo "unlinked  $name"
    fi
    continue
  fi

  # Already the right symlink → nothing to do.
  if [ -L "$target_path" ] && [ "$(readlink "$target_path")" = "$src" ]; then
    echo "ok        $name"
    continue
  fi

  # Stale symlink → drop it. Real file/dir → back it up first.
  if [ -L "$target_path" ]; then
    rm "$target_path"
  elif [ -e "$target_path" ]; then
    backup="$target_path.bak-$(date +%Y%m%d%H%M%S)"
    mv "$target_path" "$backup"
    echo "backed up $name -> $(basename "$backup")"
  fi

  ln -s "$src" "$target_path"
  echo "linked    $name"
done

echo "Done. Target: $target ($DEST_DIR)"
