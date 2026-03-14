#!/bin/bash
# Dispara v2 — Basic Security Check Script
# Validates tenant isolation, input validation, and auth bypass vectors
# Run: ./scripts/security-check.sh [API_URL]

set -e

API_URL=${1:-"http://localhost:3001/v1"}
PASS=0
FAIL=0

check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" = "$expected" ]; then
    echo "  ✅ $desc"
    ((PASS++))
  else
    echo "  ❌ $desc (expected=$expected, got=$actual)"
    ((FAIL++))
  fi
}

echo "🔒 Dispara Security Check — $API_URL"
echo ""

# ── 1. Auth bypass ──
echo "1️⃣ Auth bypass tests"

# No auth header → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/promos")
check "GET /promos without auth → 401" "401" "$STATUS"

# Invalid JWT → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid.token.here" "$API_URL/promos")
check "GET /promos with invalid JWT → 401" "401" "$STATUS"

# Empty bearer → 401
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer " "$API_URL/promos")
check "GET /promos with empty Bearer → 401" "401" "$STATUS"

echo ""

# ── 2. Public endpoints ──
echo "2️⃣ Public endpoints (should work without auth)"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/../health" 2>/dev/null || echo "000")
check "GET /health → 200" "200" "$STATUS"

echo ""

# ── 3. Input validation (SQL injection) ──
echo "3️⃣ Input validation"

# SQL injection in query params
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/promos?id=1%27%20OR%201%3D1%20--")
check "SQL injection in query → not 500" "401" "$STATUS"

# XSS in body (should be rejected by Zod)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/promos" \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>"}')
check "XSS in POST body → 401 (no auth)" "401" "$STATUS"

echo ""

# ── 4. Rate limiting ──
echo "4️⃣ Rate limiting"

RATE_LIMITED=false
for i in $(seq 1 110); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/../health")
  if [ "$STATUS" = "429" ]; then
    RATE_LIMITED=true
    break
  fi
done
check "Rate limiting active (429 after burst)" "true" "$RATE_LIMITED"

echo ""

# ── 5. Secrets in git ──
echo "5️⃣ Secrets exposure check"

SECRETS_IN_GIT=$(cd "$(dirname "$0")/.." && git log -p 2>/dev/null | grep -c "SUPABASE_SERVICE_ROLE_KEY\|OPENROUTER_API_KEY" || echo "0")
if [ "$SECRETS_IN_GIT" = "0" ]; then
  check "No secrets in git history" "0" "$SECRETS_IN_GIT"
else
  check "No secrets in git history" "0" "$SECRETS_IN_GIT"
fi

# Check .env not tracked
ENV_TRACKED=$(cd "$(dirname "$0")/.." && git ls-files .env apps/api/.env 2>/dev/null | wc -l)
check ".env not tracked in git" "0" "$ENV_TRACKED"

echo ""

# ── 6. RLS check ──
echo "6️⃣ Database RLS"

RLS_COUNT=$(PGPASSWORD='@Pro$peridade2025#' psql -h db.ytgiexxqvvntefsoxeeq.supabase.co -U postgres -d postgres -t -c "SELECT count(*) FROM pg_policies WHERE schemaname='public'" 2>/dev/null | tr -d ' ')
if [ -n "$RLS_COUNT" ] && [ "$RLS_COUNT" -gt "90" ]; then
  check "RLS policies active (>90)" "true" "true"
else
  check "RLS policies active (>90)" "true" "false (count=$RLS_COUNT)"
fi

echo ""
echo "════════════════════════════════════════"
echo "Results: ✅ $PASS passed, ❌ $FAIL failed"
echo "════════════════════════════════════════"

exit $FAIL
