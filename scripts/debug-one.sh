#!/usr/bin/env bash
# Debug helper — replicate scan logic on a single file.
EXCLUDE_DIRS=(node_modules .next .git dist build .turbo coverage)
GREP_EXCL_ARGS=()
for d in "${EXCLUDE_DIRS[@]}"; do
  GREP_EXCL_ARGS+=( --exclude-dir="$d" )
done
f="$1"
base=$(basename "$f" .ts)
base=${base%.tsx}

echo "f=$f"
echo "base=$base"
echo "filter=^\./${f}\$"
echo "--- raw matches:"
grep -rlE "from\s+['\"][^'\"]*${base}['\"]" . \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    "${GREP_EXCL_ARGS[@]}" 2>/dev/null
echo "--- after filter:"
grep -rlE "from\s+['\"][^'\"]*${base}['\"]" . \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    "${GREP_EXCL_ARGS[@]}" 2>/dev/null \
    | grep -v "^\./${f}\$" \
    | sort -u
