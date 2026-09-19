#!/usr/bin/env bash
# Post-deploy smoke for staging and production. READ-ONLY: it only performs
# anonymous GET requests against public endpoints; it creates no data and
# requires no credentials.
#
# Usage: bash scripts/post-deploy-smoke.sh <base-url> [expected-release-sha]
set -euo pipefail

BASE_URL="${1:?usage: post-deploy-smoke.sh <base-url> [expected-release-sha]}"
EXPECTED_RELEASE_SHA="${2:-}"

echo "== Frigo post-deploy smoke: ${BASE_URL} =="

expect_http() { # name url expected_status
  local name="$1" url="$2" expected="$3" code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url")"
  if [[ "$code" != "$expected" ]]; then
    echo "FAIL ${name}: expected HTTP ${expected}, got ${code} (${url})"
    exit 1
  fi
  echo "ok ${name}: HTTP ${code}"
}

expect_http "landing page" "${BASE_URL}/" 200
expect_http "public liveness" "${BASE_URL}/api/v1/health" 200

header_value() { # url header-name
  local url="$1" name="$2"
  curl -sS -D - -o /dev/null --max-time 15 "$url" |
    awk -v wanted="$name" 'tolower($0) ~ "^" tolower(wanted) ":" { sub(/^[^:]+:[[:space:]]*/, ""); sub(/\r$/, ""); value = value ? value ", " $0 : $0 } END { print value }'
}

require_cache_token() { # name url token
  local name="$1" url="$2" token="$3" cache_control cache_control_lower
  cache_control="$(header_value "$url" "cache-control")"
  cache_control_lower="$(printf '%s' "$cache_control" | tr '[:upper:]' '[:lower:]')"
  if [[ ",$cache_control_lower," != *"$token"* ]]; then
    echo "FAIL ${name}: Cache-Control lacks '${token}' (${cache_control:-missing})"
    exit 1
  fi
  echo "ok ${name}: Cache-Control ${cache_control}"
}

AUTH_HTML="$(curl -sS --max-time 15 "${BASE_URL}/auth")"
require_cache_token "auth shell" "${BASE_URL}/auth" "no-store"
require_cache_token "service worker" "${BASE_URL}/sw.js" "no-store"

ASSET_PATH="$(printf '%s' "$AUTH_HTML" | grep -oE '/assets/[^"[:space:]]+\.js' | head -n 1 || true)"
if [[ -z "$ASSET_PATH" ]]; then
  echo "FAIL asset cache: no hashed JavaScript asset found in /auth"
  exit 1
fi
ASSET_CACHE_CONTROL="$(header_value "${BASE_URL}${ASSET_PATH}" "cache-control")"
ASSET_CACHE_CONTROL_LOWER="$(printf '%s' "$ASSET_CACHE_CONTROL" | tr '[:upper:]' '[:lower:]')"
for token in public max-age=31536000 immutable; do
  if [[ ",$ASSET_CACHE_CONTROL_LOWER," != *"${token}"* ]]; then
    echo "FAIL asset cache: Cache-Control lacks '${token}' (${ASSET_CACHE_CONTROL:-missing})"
    exit 1
  fi
done
if [[ "$ASSET_CACHE_CONTROL_LOWER" == *"no-store"* || "$ASSET_CACHE_CONTROL_LOWER" == *"no-cache"* ]]; then
  echo "FAIL asset cache: conflicting revalidation directive (${ASSET_CACHE_CONTROL})"
  exit 1
fi
echo "ok asset cache: ${ASSET_CACHE_CONTROL}"

if [[ -n "$EXPECTED_RELEASE_SHA" ]]; then
  if [[ ! "$EXPECTED_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "FAIL service worker release: expected SHA is not canonical"
    exit 1
  fi
  SW_BODY="$(curl -sS --max-time 15 "${BASE_URL}/sw.js")"
  if [[ "$SW_BODY" != *"const BUILD_ID = '${EXPECTED_RELEASE_SHA}';"* ]]; then
    echo "FAIL service worker release: deployed SHA is not embedded in /sw.js"
    exit 1
  fi
  echo "ok service worker release: ${EXPECTED_RELEASE_SHA}"
fi

# Readiness: status must be ok or degraded (never unhealthy) and the D1
# database must answer. The body is sanitized (no secrets) by construction.
curl -sS --max-time 15 "${BASE_URL}/api/v1/health/ready" | node --input-type=module -e '
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  let body;
  try {
    body = JSON.parse(input);
  } catch {
    console.error("FAIL readiness: response is not valid JSON");
    process.exit(1);
  }

  if (body.status === "unhealthy") {
    console.error("FAIL readiness: status is unhealthy");
    process.exit(1);
  }
  if (body.services?.database !== "ok") {
    console.error("FAIL readiness: database is not ok:", body.services?.database);
    process.exit(1);
  }
  if (body.config && body.config.ok === false && body.config.issues?.some((i) => i.severity === "fatal")) {
    console.error("FAIL readiness: fatal configuration issues:", JSON.stringify(body.config.issues));
    process.exit(1);
  }
  console.log("ok readiness:", body.status, "database:", body.services.database, "environment:", body.environment || "unknown");
'

echo "== Smoke passed =="
