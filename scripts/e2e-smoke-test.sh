#!/bin/bash
# Dispara v2 — E2E Smoke Test
# Tests the critical path: Auth → Promos → Groups → Dispatch
# Requires: API running + valid Supabase token
# Usage: ./scripts/e2e-smoke-test.sh [API_URL] [AUTH_TOKEN] [TENANT_ID]

set -e

API_URL=${1:-"http://localhost:3001/v1"}
TOKEN=${2:-"$DISPARA_TEST_TOKEN"}
TENANT_ID=${3:-"$DISPARA_TEST_TENANT"}
PASS=0
FAIL=0

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <api_url> <auth_token> <tenant_id>"
  echo "Or set DISPARA_TEST_TOKEN and DISPARA_TEST_TENANT env vars"
  exit 1
fi

AUTH="-H 'Authorization: Bearer $TOKEN' -H 'X-Tenant-ID: $TENANT_ID'"

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

echo "🧪 Dispara E2E Smoke Test — $API_URL"
echo ""

# ── 1. Health ──
echo "1️⃣ Health Check"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/../health")
check "GET /health → 200" "200" "$STATUS"

# ── 2. Auth ──
echo "2️⃣ Auth (authenticated requests)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT_ID" \
  "$API_URL/promos")
check "GET /promos with auth → 200" "200" "$STATUS"

# ── 3. List WA Sessions ──
echo "3️⃣ WhatsApp Sessions"
SESSIONS=$(curl -s \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT_ID" \
  "$API_URL/wa/sessions")
SESSION_COUNT=$(echo "$SESSIONS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('sessions',[])))" 2>/dev/null || echo "0")
echo "  ℹ️ $SESSION_COUNT sessions found"
check "GET /wa/sessions → valid response" "true" "$([ -n "$SESSIONS" ] && echo true || echo false)"

# ── 4. List Groups ──
echo "4️⃣ Groups"
GROUPS=$(curl -s \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT_ID" \
  "$API_URL/groups")
GROUP_COUNT=$(echo "$GROUPS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('pagination',{}).get('total',0))" 2>/dev/null || echo "0")
echo "  ℹ️ $GROUP_COUNT groups found"
check "GET /groups → valid response" "true" "$([ -n "$GROUPS" ] && echo true || echo false)"

# ── 5. List Promos ──
echo "5️⃣ Promos"
PROMOS=$(curl -s \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT_ID" \
  "$API_URL/promos")
PROMO_COUNT=$(echo "$PROMOS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('pagination',{}).get('total',0))" 2>/dev/null || echo "0")
echo "  ℹ️ $PROMO_COUNT promos found"
check "GET /promos → valid response" "true" "$([ -n "$PROMOS" ] && echo true || echo false)"

# ── 6. List Dispatches ──
echo "6️⃣ Dispatches"
DISPATCHES=$(curl -s \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT_ID" \
  "$API_URL/dispatches")
check "GET /dispatches → valid response" "true" "$([ -n "$DISPATCHES" ] && echo true || echo false)"

# ── 7. Commissions API ──
echo "7️⃣ Commissions"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT_ID" \
  "$API_URL/commissions/summary?from=2026-01-01&to=2026-12-31")
check "GET /commissions/summary → 200" "200" "$STATUS"

# ── 8. Agent Interaction ──
echo "8️⃣ Agent (Copilot)"
AGENT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{"message":"busca fone bluetooth"}' \
  "$API_URL/agent/interact" 2>/dev/null)
check "POST /agent/interact → 200 or 201" "true" "$([ "$AGENT_STATUS" = "200" ] || [ "$AGENT_STATUS" = "201" ] && echo true || echo false)"

echo ""
echo "════════════════════════════════════════"
echo "Results: ✅ $PASS passed, ❌ $FAIL failed"
echo "════════════════════════════════════════"

exit $FAIL
