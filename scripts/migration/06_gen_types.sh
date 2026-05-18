#!/usr/bin/env bash
# 06_gen_types.sh — regenerate src/integrations/supabase/types.ts.
# Run after every migration applied to the new project.
# Usage: ./06_gen_types.sh <NEW_PROJECT_REF>
set -euo pipefail
REF="${1:?usage: $0 <NEW_PROJECT_REF>}"
OUT="src/integrations/supabase/types.ts"

supabase gen types typescript --project-id "$REF" --schema public > "$OUT"
echo "[types] wrote $OUT"
wc -l "$OUT"
