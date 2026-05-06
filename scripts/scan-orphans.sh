#!/usr/bin/env bash
# scan-orphans.sh
# Finds files in lib/v1 whose exports are not imported anywhere else in the project.
#
# Usage: run from project root
#   bash scan-orphans.sh
#
# What it does:
#   1. List every .ts file in lib/v1
#   2. For each file, find its export symbols
#   3. grep the entire project (excluding node_modules/.next/.git) for imports of that file
#   4. Report files with zero importers as orphan candidates
#   5. Report files with importers as 'in use' with caller list
#
# Safe — read-only. No deletes, no moves.

set -e

LIB="lib/v1"
EXCLUDE_DIRS=(node_modules .next .git dist build .turbo coverage)

if [ ! -d "$LIB" ]; then
  echo "ERROR: $LIB not found. Run from project root."
  exit 1
fi

# Build find-exclude args (find: -not -path) and grep-exclude args (grep: --exclude-dir).
# These two tools have different exclusion syntax — passing find-style flags to grep
# silently errors out under 2>/dev/null and returns empty matches for every file.
EXCL_ARGS=()
GREP_EXCL_ARGS=()
for d in "${EXCLUDE_DIRS[@]}"; do
  EXCL_ARGS+=( -not -path "*/$d/*" )
  GREP_EXCL_ARGS+=( --exclude-dir="$d" )
done

echo "Scanning $LIB for orphans across the project..."
echo "================================================"
echo ""

ORPHANS=()
INUSE=()

while IFS= read -r f; do
  # Get the basename without extension — what import paths reference
  base=$(basename "$f" .ts)
  base=${base%.tsx}

  # Skip index files (their consumers reference the directory)
  if [ "$base" = "index" ]; then continue; fi

  # Search for any file that imports from this filename. Require a path
  # separator BEFORE the basename so short names like 'base' don't
  # false-match suffixes of unrelated imports (e.g. '@/lib/supabase'
  # ending in "base" was tricking the unanchored pattern). Every real
  # import has a / before the basename.
  callers=$(grep -rlE "from\s+['\"][^'\"]*/${base}['\"]" . \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    "${GREP_EXCL_ARGS[@]}" 2>/dev/null \
    | grep -v "^\./${f}$" \
    | sort -u || true)

  if [ -z "$callers" ]; then
    ORPHANS+=("$f")
  else
    caller_count=$(echo "$callers" | wc -l | tr -d ' ')
    INUSE+=("$f|$caller_count")
  fi
done < <(find "$LIB" -type f \( -name '*.ts' -o -name '*.tsx' \) "${EXCL_ARGS[@]}" | sort)

echo "## ORPHAN CANDIDATES (no importers found)"
echo ""
if [ ${#ORPHANS[@]} -eq 0 ]; then
  echo "  (none)"
else
  for f in "${ORPHANS[@]}"; do
    size=$(wc -c < "$f" | tr -d ' ')
    echo "  $f  ($size bytes)"
  done
fi

echo ""
echo "## IN USE (file | caller count)"
echo ""
for entry in "${INUSE[@]}"; do
  IFS='|' read -r f count <<< "$entry"
  printf "  %-60s %s callers\n" "$f" "$count"
done

echo ""
echo "## SUMMARY"
echo "  Total scanned:    $((${#ORPHANS[@]} + ${#INUSE[@]}))"
echo "  Orphan candidates: ${#ORPHANS[@]}"
echo "  In use:            ${#INUSE[@]}"
echo ""
echo "Next step: review orphan candidates manually before deleting."
echo "Some 'orphans' may be entry-point routes called by Next.js framework, not imported by code."
